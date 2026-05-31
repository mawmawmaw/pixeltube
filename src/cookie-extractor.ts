// Chromium-family cookie extractor for Linux / macOS / Windows.
//
// Bypasses yt-dlp's --cookies-from-browser when its native cookie extraction
// is unreliable. The most common case is the Linux gnome-keyring "Chromium
// Safe Storage" label collision with other Chromium-based apps (VS Code,
// Slack, Discord, …): yt-dlp matches by label only and picks the wrong one.
//
// We query keyrings with attribute filtering (Linux gnome-keyring, KWallet),
// `security` (macOS), or DPAPI via PowerShell (Windows), do the AES-CBC or
// AES-GCM decryption ourselves, and write a Netscape cookies.txt for yt-dlp.

import { execFileSync } from "node:child_process"
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { createDecipheriv, pbkdf2Sync } from "node:crypto"

// ─── Public types ──────────────────────────────────────────────────────────

export interface ExtractedCookies {
	cookiesFile: string
	count: number
	cleanup: () => void
}

export interface ExtractionFailure {
	reason: string
}

export type ExtractionResult = ExtractedCookies | ExtractionFailure

export function isExtracted(r: ExtractionResult | null): r is ExtractedCookies {
	return r !== null && "cookiesFile" in r
}

// ─── Browser info table ────────────────────────────────────────────────────

const BASE_BROWSERS = ["chrome", "chromium", "brave", "edge"] as const
type ChromiumBase = (typeof BASE_BROWSERS)[number]

interface BrowserInfo {
	// gnome-keyring attribute filter
	linuxAppAttr: string
	// Used as "<Name> Safe Storage" in macOS Keychain and Linux KWallet
	keyringName: string
	// Native Linux install path under $HOME
	linuxPath: string
	// Snap install path under $HOME (null if not commonly Snap-packaged)
	linuxSnapPath: string | null
	// Flatpak install path under $HOME
	linuxFlatpakPath: string | null
	// macOS path under $HOME
	macPath: string
	// Windows path under %LOCALAPPDATA%
	windowsPath: string
}

const BROWSER_INFO: Record<ChromiumBase, BrowserInfo> = {
	chrome: {
		linuxAppAttr: "chrome",
		keyringName: "Chrome",
		linuxPath: ".config/google-chrome",
		linuxSnapPath: null,
		linuxFlatpakPath: null,
		macPath: "Library/Application Support/Google/Chrome",
		windowsPath: "Google/Chrome/User Data",
	},
	chromium: {
		linuxAppAttr: "chromium",
		keyringName: "Chromium",
		linuxPath: ".config/chromium",
		linuxSnapPath: "snap/chromium/common/.config/chromium",
		linuxFlatpakPath: ".var/app/org.chromium.Chromium/config/chromium",
		macPath: "Library/Application Support/Chromium",
		windowsPath: "Chromium/User Data",
	},
	brave: {
		linuxAppAttr: "brave",
		keyringName: "Brave",
		linuxPath: ".config/BraveSoftware/Brave-Browser",
		linuxSnapPath: null,
		linuxFlatpakPath: ".var/app/com.brave.Browser/config/BraveSoftware/Brave-Browser",
		macPath: "Library/Application Support/BraveSoftware/Brave-Browser",
		windowsPath: "BraveSoftware/Brave-Browser/User Data",
	},
	edge: {
		linuxAppAttr: "microsoft-edge",
		keyringName: "Microsoft Edge",
		linuxPath: ".config/microsoft-edge",
		linuxSnapPath: null,
		linuxFlatpakPath: null,
		macPath: "Library/Application Support/Microsoft Edge",
		windowsPath: "Microsoft/Edge/User Data",
	},
}

// ─── Shared helpers ────────────────────────────────────────────────────────

// Chromium stores expires_utc as microseconds since 1601-01-01.
const CHROMIUM_EPOCH_OFFSET_US = 11_644_473_600_000_000n

// Parses BROWSER[+KEYRING][:PROFILE] into its parts. Exported for tests.
export function parseSpec(spec: string): { base: string; profile: string } {
	const colon = spec.indexOf(":")
	const head = colon === -1 ? spec : spec.slice(0, colon)
	const profile = colon === -1 ? "Default" : spec.slice(colon + 1)
	const base = head.split("+", 1)[0]
	return { base, profile }
}

function isChromiumBase(name: string): name is ChromiumBase {
	return (BASE_BROWSERS as readonly string[]).includes(name)
}

function which(cmd: string): boolean {
	try {
		execFileSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" })
		return true
	} catch {
		return false
	}
}

// Cookies DB lives at `<profile>/Cookies` (older) or `<profile>/Network/Cookies` (newer).
function locateCookiesDb(profileDir: string): string | null {
	const newer = join(profileDir, "Network", "Cookies")
	if (existsSync(newer)) return newer
	const older = join(profileDir, "Cookies")
	if (existsSync(older)) return older
	return null
}

function copyToTempDb(sourceDb: string): { tmpDir: string; tmpDb: string } | { error: string } {
	let tmpDir: string
	try {
		tmpDir = mkdtempSync(join(tmpdir(), "pixeltube-cookies-"))
	} catch (err) {
		return { error: `cannot create temp dir: ${(err as Error).message}` }
	}
	const tmpDb = join(tmpDir, "Cookies")
	try {
		copyFileSync(sourceDb, tmpDb)
	} catch (err) {
		rmSync(tmpDir, { recursive: true, force: true })
		return { error: `cannot read ${sourceDb}: ${(err as Error).message}` }
	}
	return { tmpDir, tmpDb }
}

function readMetaVersion(tmpDb: string): number {
	try {
		const v = execFileSync("sqlite3", [tmpDb, "SELECT value FROM meta WHERE key='version'"]).toString().trim()
		return Number.parseInt(v, 10) || 0
	} catch {
		return 0
	}
}

interface CookieRow {
	host: string
	name: string
	hex: string
	path: string
	expiresUtc: string
	isSecure: string
}

function queryCookieRows(tmpDb: string): CookieRow[] | { error: string } {
	const sql =
		"SELECT host_key, name, hex(encrypted_value), path, expires_utc, is_secure FROM cookies " +
		"WHERE host_key LIKE '%youtube.com' OR host_key LIKE '%google.com' OR host_key LIKE '%youtu.be'"
	let rows: string
	try {
		rows = execFileSync("sqlite3", [tmpDb, "-separator", "\t", sql]).toString()
	} catch (err) {
		return { error: `cookies query failed: ${(err as Error).message}` }
	}
	const out: CookieRow[] = []
	for (const row of rows.split("\n")) {
		if (!row) continue
		const fields = row.split("\t")
		if (fields.length < 6) continue
		out.push({
			host: fields[0],
			name: fields[1],
			hex: fields[2],
			path: fields[3],
			expiresUtc: fields[4],
			isSecure: fields[5],
		})
	}
	return out
}

function writeNetscapeFile(
	tmpDir: string,
	browserLabel: string,
	rows: CookieRow[],
	decrypt: (ciphertext: Buffer) => string | null,
): ExtractedCookies | ExtractionFailure {
	const lines: string[] = ["# Netscape HTTP Cookie File", `# Extracted by pixeltube from ${browserLabel}`]
	let count = 0
	for (const r of rows) {
		const ciphertext = Buffer.from(r.hex, "hex")
		const value = decrypt(ciphertext)
		if (value === null) continue
		lines.push(
			[
				r.host,
				r.host.startsWith(".") ? "TRUE" : "FALSE",
				r.path,
				r.isSecure === "1" ? "TRUE" : "FALSE",
				formatExpires(r.expiresUtc),
				r.name,
				value,
			].join("\t"),
		)
		count++
	}

	if (count === 0) {
		rmSync(tmpDir, { recursive: true, force: true })
		return { reason: "no decryptable cookies found for youtube.com/google.com" }
	}

	const cookiesFile = join(tmpDir, "cookies.txt")
	writeFileSync(cookiesFile, `${lines.join("\n")}\n`, { mode: 0o600 })
	return {
		cookiesFile,
		count,
		cleanup: () => {
			try {
				rmSync(tmpDir, { recursive: true, force: true })
			} catch {
				// best-effort
			}
		},
	}
}

function formatExpires(expiresUtcStr: string): string {
	if (!expiresUtcStr || expiresUtcStr === "0") return "0"
	try {
		const us = BigInt(expiresUtcStr)
		const unixSec = (us - CHROMIUM_EPOCH_OFFSET_US) / 1_000_000n
		return unixSec > 0n ? unixSec.toString() : "0"
	} catch {
		return "0"
	}
}

// ─── Decryption ────────────────────────────────────────────────────────────

// AES-128-CBC for v10/v11 cookies (Linux + macOS). Exported for tests.
export function decryptChromiumCookie(ciphertext: Buffer, key: Buffer, iv: Buffer, metaVersion: number): string | null {
	if (ciphertext.length < 3) return null
	const version = ciphertext.subarray(0, 3).toString("utf8")
	if (version !== "v10" && version !== "v11") return null
	try {
		const decipher = createDecipheriv("aes-128-cbc", key, iv)
		let plaintext = Buffer.concat([decipher.update(ciphertext.subarray(3)), decipher.final()])
		if (metaVersion >= 24 && plaintext.length >= 32) plaintext = plaintext.subarray(32)
		return plaintext.toString("utf8")
	} catch {
		return null
	}
}

// AES-256-GCM for v10 cookies on Windows.
// Layout: "v10" | 12-byte nonce | ciphertext | 16-byte auth tag
function decryptWindowsCookie(ciphertext: Buffer, key: Buffer, metaVersion: number): string | null {
	if (ciphertext.length < 3 + 12 + 16) return null
	const version = ciphertext.subarray(0, 3).toString("utf8")
	if (version !== "v10") return null // v20 (app-bound) not supported
	const nonce = ciphertext.subarray(3, 15)
	const tag = ciphertext.subarray(ciphertext.length - 16)
	const body = ciphertext.subarray(15, ciphertext.length - 16)
	try {
		const decipher = createDecipheriv("aes-256-gcm", key, nonce)
		decipher.setAuthTag(tag)
		let plaintext = Buffer.concat([decipher.update(body), decipher.final()])
		if (metaVersion >= 24 && plaintext.length >= 32) plaintext = plaintext.subarray(32)
		return plaintext.toString("utf8")
	} catch {
		return null
	}
}

// ─── Linux ─────────────────────────────────────────────────────────────────

function linuxProfileDirs(base: ChromiumBase, profile: string): string[] {
	const info = BROWSER_INFO[base]
	const home = homedir()
	const out: string[] = [join(home, info.linuxPath, profile)]
	if (info.linuxSnapPath) out.push(join(home, info.linuxSnapPath, profile))
	if (info.linuxFlatpakPath) out.push(join(home, info.linuxFlatpakPath, profile))
	return out
}

function gnomeKeyringPassword(appAttr: string): string | null {
	try {
		const raw = execFileSync("secret-tool", ["lookup", "application", appAttr], {
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 5000,
		})
		const s = raw.toString("utf8").replace(/\n$/, "")
		return s || null
	} catch {
		return null
	}
}

function kwalletPassword(keyringName: string): string | null {
	try {
		const raw = execFileSync(
			"kwallet-query",
			["-r", `${keyringName} Safe Storage`, "-f", `${keyringName} Keys`, "kdewallet"],
			{ stdio: ["ignore", "pipe", "pipe"], timeout: 5000 },
		)
		const s = raw.toString("utf8").replace(/\n$/, "")
		// kwallet-query prints "Failed to read..." to stdout on miss in some versions
		if (!s || /failed/i.test(s)) return null
		return s
	} catch {
		return null
	}
}

function extractLinux(base: ChromiumBase, profile: string): ExtractionResult {
	if (!which("sqlite3")) return { reason: "sqlite3 not found (install sqlite)" }

	const info = BROWSER_INFO[base]

	// Find a profile dir with a cookies db
	let cookiesDb: string | null = null
	let chosenProfileDir = ""
	for (const dir of linuxProfileDirs(base, profile)) {
		const db = locateCookiesDb(dir)
		if (db) {
			cookiesDb = db
			chosenProfileDir = dir
			break
		}
	}
	if (!cookiesDb) {
		return { reason: `no cookies db found for ${base} (tried native, Snap, Flatpak paths)` }
	}

	// Get the v11 key from whichever keyring is available
	let password: string | null = null
	let keyringUsed = ""
	if (which("secret-tool")) {
		password = gnomeKeyringPassword(info.linuxAppAttr)
		if (password) keyringUsed = "gnome-keyring"
	}
	if (!password && which("kwallet-query")) {
		password = kwalletPassword(info.keyringName)
		if (password) keyringUsed = "kwallet"
	}
	// For basic-text storage chromium uses the fixed "peanuts" password and writes
	// everything as v10 cookies. Try as a last resort.
	if (!password) {
		password = "peanuts"
		keyringUsed = "basic-text fallback"
	}

	const copied = copyToTempDb(cookiesDb)
	if ("error" in copied) return { reason: copied.error }
	const { tmpDir, tmpDb } = copied

	const metaVersion = readMetaVersion(tmpDb)
	const rows = queryCookieRows(tmpDb)
	if ("error" in rows) {
		rmSync(tmpDir, { recursive: true, force: true })
		return { reason: rows.error }
	}

	const key = pbkdf2Sync(password, "saltysalt", 1, 16, "sha1")
	const iv = Buffer.alloc(16, 0x20)

	return writeNetscapeFile(tmpDir, `${base} via ${keyringUsed} (${chosenProfileDir})`, rows, (ct) =>
		decryptChromiumCookie(ct, key, iv, metaVersion),
	)
}

// ─── macOS ─────────────────────────────────────────────────────────────────

function macKeychainPassword(keyringName: string): string | null {
	try {
		// -w writes password to stdout; account is the browser keyring name
		const raw = execFileSync("security", ["find-generic-password", "-w", "-s", `${keyringName} Safe Storage`], {
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 30_000,
		})
		return raw.toString("utf8").replace(/\n$/, "") || null
	} catch {
		return null
	}
}

function extractMacOS(base: ChromiumBase, profile: string): ExtractionResult {
	if (!which("sqlite3")) return { reason: "sqlite3 not found" }
	const info = BROWSER_INFO[base]

	const profileDir = join(homedir(), info.macPath, profile)
	const cookiesDb = locateCookiesDb(profileDir)
	if (!cookiesDb) return { reason: `no cookies db at ${profileDir}` }

	const password = macKeychainPassword(info.keyringName)
	if (!password) {
		return { reason: `no Keychain entry "${info.keyringName} Safe Storage" (declined prompt?)` }
	}

	const copied = copyToTempDb(cookiesDb)
	if ("error" in copied) return { reason: copied.error }
	const { tmpDir, tmpDb } = copied

	const metaVersion = readMetaVersion(tmpDb)
	const rows = queryCookieRows(tmpDb)
	if ("error" in rows) {
		rmSync(tmpDir, { recursive: true, force: true })
		return { reason: rows.error }
	}

	// macOS uses 1003 PBKDF2 iterations (vs Linux's 1)
	const key = pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1")
	const iv = Buffer.alloc(16, 0x20)

	return writeNetscapeFile(tmpDir, `${base} via Keychain`, rows, (ct) =>
		decryptChromiumCookie(ct, key, iv, metaVersion),
	)
}

// ─── Windows ───────────────────────────────────────────────────────────────

function windowsDpapiUnprotect(encryptedB64: string): Buffer | null {
	// PowerShell unwraps a DPAPI blob using the current user's key. We pass the
	// blob via an env var to avoid escaping issues, and round-trip through base64.
	const script =
		"$b = [Convert]::FromBase64String($Env:PT_BLOB);" +
		"$u = [System.Security.Cryptography.ProtectedData]::Unprotect($b, $null, " +
		"[System.Security.Cryptography.DataProtectionScope]::CurrentUser);" +
		"[Convert]::ToBase64String($u)"
	try {
		const out = execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], {
			env: { ...process.env, PT_BLOB: encryptedB64 },
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 15_000,
		})
		const b64 = out.toString("utf8").trim()
		return b64 ? Buffer.from(b64, "base64") : null
	} catch {
		return null
	}
}

function windowsLoadEncryptedKey(profileRoot: string): Buffer | null {
	const localStatePath = join(profileRoot, "Local State")
	try {
		const json = JSON.parse(readFileSync(localStatePath, "utf8"))
		const b64 = json?.os_crypt?.encrypted_key
		if (typeof b64 !== "string") return null
		const blob = Buffer.from(b64, "base64")
		// Strip "DPAPI" 5-byte prefix
		if (blob.subarray(0, 5).toString("ascii") !== "DPAPI") return null
		return blob.subarray(5)
	} catch {
		return null
	}
}

function extractWindows(base: ChromiumBase, profile: string): ExtractionResult {
	if (!which("sqlite3")) return { reason: "sqlite3 not found (install sqlite)" }
	const info = BROWSER_INFO[base]
	const localAppData = process.env.LOCALAPPDATA
	if (!localAppData) return { reason: "%LOCALAPPDATA% is not set" }

	const profileRoot = join(localAppData, info.windowsPath)
	const profileDir = join(profileRoot, profile)
	const cookiesDb = locateCookiesDb(profileDir)
	if (!cookiesDb) return { reason: `no cookies db at ${profileDir}` }

	const encryptedKey = windowsLoadEncryptedKey(profileRoot)
	if (!encryptedKey) return { reason: `cannot read encrypted_key from "${profileRoot}\\Local State"` }

	const key = windowsDpapiUnprotect(encryptedKey.toString("base64"))
	if (!key) return { reason: "DPAPI unwrap failed (PowerShell missing or refused)" }

	const copied = copyToTempDb(cookiesDb)
	if ("error" in copied) return { reason: copied.error }
	const { tmpDir, tmpDb } = copied

	const metaVersion = readMetaVersion(tmpDb)
	const rows = queryCookieRows(tmpDb)
	if ("error" in rows) {
		rmSync(tmpDir, { recursive: true, force: true })
		return { reason: rows.error }
	}

	return writeNetscapeFile(tmpDir, `${base} via DPAPI`, rows, (ct) => decryptWindowsCookie(ct, key, metaVersion))
}

// ─── Top-level dispatcher ──────────────────────────────────────────────────

// Returns extracted cookies on success, a failure with reason on a recoverable
// problem (caller falls back to yt-dlp's --cookies-from-browser), or null if
// the spec/platform isn't applicable (e.g. firefox).
export function tryExtractChromiumCookies(browserSpec: string): ExtractionResult | null {
	const { base, profile } = parseSpec(browserSpec)
	if (!isChromiumBase(base)) return null

	if (process.platform === "linux") return extractLinux(base, profile)
	if (process.platform === "darwin") return extractMacOS(base, profile)
	if (process.platform === "win32") return extractWindows(base, profile)
	return null
}
