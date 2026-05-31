// YouTube authentication check via yt-dlp cookies

import type { YtDlpClient } from "./types.js"
import type { YtDlpError } from "./ytdlp.js"

const SUBS_URL = "https://www.youtube.com/feed/subscriptions"

export async function isLoggedIn(client: YtDlpClient): Promise<boolean> {
	try {
		const result = await client.run(["--flat-playlist", "--playlist-end", "1", "--print", "%(title)s", SUBS_URL], {
			timeout: 15000,
			auth: true,
		})
		return !!result
	} catch {
		return false
	}
}

export async function verifyLogin(client: YtDlpClient, cookieArgs: string[]): Promise<boolean> {
	const usingFile: boolean = cookieArgs[0] === "--cookies"
	const usingBrowser: boolean = cookieArgs[0] === "--cookies-from-browser"
	const browserName = usingBrowser ? cookieArgs[1] : null

	if (usingFile) {
		console.log(`Checking YouTube authentication via cookies file: ${cookieArgs[1]}\n`)
	} else if (usingBrowser) {
		console.log(`Checking YouTube authentication via ${browserName} cookies...`)
		if (process.platform === "darwin") {
			console.log("(macOS will prompt for your password to access the cookie keychain — this is normal)\n")
		} else {
			console.log("")
		}
	} else {
		console.error("No cookie source configured. Pass --browser NAME or --cookies FILE.")
		process.exit(1)
	}

	try {
		const { stdout, stderr } = await client.runDetailed(
			["--flat-playlist", "--playlist-end", "1", "--print", "%(title)s", SUBS_URL],
			{ timeout: 30000, auth: true, verbose: true },
		)

		if (stdout) {
			console.log("Logged in!")
			return true
		}

		console.error("Authenticated request returned no data — YouTube did not recognize your cookies.\n")
		const hint = diagnoseStderr(stderr)
		if (hint) {
			console.error(hint)
		} else {
			console.error("Likely causes:")
			console.error(`  - You're not signed in to YouTube in ${browserName ?? "your browser"}`)
			console.error("  - Your session expired (sign out and back in to YouTube)")
			console.error("  - yt-dlp is reading the wrong browser profile")
			console.error("\nWorkaround: export cookies via a browser extension and pass --cookies FILE")
		}
		if (stderr) {
			console.error("\nyt-dlp output:")
			console.error(stderr)
		}
		return false
	} catch (err) {
		const e = err as YtDlpError
		const stderr = e.stderr ?? ""
		console.error("Login check failed.\n")
		const hint = diagnoseStderr(stderr)
		if (hint) {
			console.error(hint)
		} else {
			printTroubleshooting(usingFile, browserName)
		}
		console.error("\nyt-dlp output:")
		console.error((stderr || e.message || String(err)).trim())
		process.exit(1)
	}
}

// Detects known yt-dlp failure modes from stderr and returns targeted advice,
// or null if nothing matched.
function diagnoseStderr(stderr: string): string | null {
	if (!stderr) return null
	const s = stderr.toLowerCase()

	if (s.includes("secretstorage") && s.includes("not installed")) {
		const installCmd = pythonSecretstorageInstallCmd()
		return [
			"yt-dlp can't read the Chrome/Chromium cookie key because the Python `secretstorage` module is missing.",
			"",
			`Install it: ${installCmd}`,
			"Then re-run `pixeltube login`.",
		].join("\n")
	}

	// AES-CBC decrypt fail with secretstorage available usually means yt-dlp
	// picked the wrong keyring entry — common on Linux when another Chromium-
	// based app (VS Code, Slack, Discord, …) stored its own "Chromium Safe
	// Storage" entry. yt-dlp matches by label only and grabs whichever comes
	// first. See https://github.com/yt-dlp/yt-dlp/issues — keyring label collision.
	if (s.includes("failed to decrypt cookie") || s.includes("possibly the key is wrong")) {
		return [
			"yt-dlp got a key from your keyring but it's the wrong one — cookies wouldn't decrypt.",
			"",
			"This usually means another Chromium-based app (VS Code, Slack, Discord, etc.)",
			"created a keyring entry also labelled 'Chromium Safe Storage', and yt-dlp",
			"picked that one instead of your browser's. yt-dlp matches by label only.",
			"",
			"Workaround: export cookies via a browser extension and pass --cookies FILE",
			"  1. Install 'Get cookies.txt LOCALLY' in Chromium",
			"  2. Go to youtube.com (signed in), click the extension, export to ~/cookies.txt",
			"  3. Run: pixeltube login --cookies ~/cookies.txt",
		].join("\n")
	}

	if (s.includes("cannot decrypt v11 cookies")) {
		return [
			"yt-dlp could not find the key to decrypt your browser's cookies.",
			"",
			"Likely causes (Linux):",
			"  - The system keyring (gnome-keyring or kwallet) isn't running or is locked",
			"  - The Python `secretstorage` module isn't installed",
			"      Arch:   sudo pacman -S python-secretstorage",
			"      Debian: sudo apt install python3-secretstorage",
			"      Other:  pip install --user secretstorage",
			"  - Your desktop env isn't recognised by yt-dlp (e.g. Hyprland/Sway)",
			"      Try --browser chromium+gnomekeyring (or +kwallet)",
			"  - The browser is installed via Snap/Flatpak, which uses a different keyring",
			"",
			"Workaround: export cookies via a browser extension and pass --cookies FILE",
		].join("\n")
	}

	if (s.includes("kwallet-query failed")) {
		return [
			"yt-dlp couldn't read the KWallet keyring.",
			"Open KWallet and make sure it's unlocked, or pass --cookies FILE with an exported cookies.txt.",
		].join("\n")
	}

	if (s.includes("could not copy") && s.includes("cookie")) {
		return [
			"yt-dlp couldn't read the browser's cookie database — usually because the browser is still running.",
			"Fully close the browser (check for background processes) and retry.",
		].join("\n")
	}

	return null
}

function pythonSecretstorageInstallCmd(): string {
	if (process.platform !== "linux") return "pip install --user secretstorage"
	// Distro-agnostic suggestion — list common package managers
	return "sudo pacman -S python-secretstorage  (Arch)\n           sudo apt install python3-secretstorage  (Debian/Ubuntu)\n           sudo dnf install python3-secretstorage  (Fedora)"
}

function printTroubleshooting(usingFile: boolean, browserName: string | null): void {
	if (usingFile) {
		console.error("Make sure:")
		console.error("  1. The cookies file path is correct")
		console.error("  2. It was exported while logged into YouTube")
		console.error("  3. The cookies have not expired (re-export if needed)")
		return
	}

	const browser = browserName ?? "your browser"
	console.error("Make sure:")
	console.error(`  1. You are logged into YouTube in ${browser}`)
	console.error(`  2. ${browser} is fully closed (yt-dlp needs to read the cookie database)`)
	console.error("  3. yt-dlp is up to date")

	if (process.platform === "linux") {
		console.error("\nOn Linux, also check:")
		console.error("  - A keyring daemon (gnome-keyring or kwallet) is running and unlocked")
		console.error(
			"  - The Python `secretstorage` module is installed (sudo pacman -S python-secretstorage / apt: python3-secretstorage)",
		)
		console.error("  - If the browser is installed via Snap/Flatpak, cookie access may be sandboxed")
		console.error("  - Try a different browser with --browser firefox (or chromium/brave/edge)")
		console.error("  - Or export cookies to a file and use --cookies FILE")
	} else if (process.platform === "win32") {
		console.error("\nOn Windows, also check:")
		console.error("  - The browser process is fully closed (check Task Manager)")
		console.error("  - Or export cookies to a file and use --cookies FILE")
	}
}
