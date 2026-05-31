import { describe, it, expect } from "vitest"
import { createCipheriv, pbkdf2Sync, createHash } from "node:crypto"
import { decryptChromiumCookie, isExtracted, parseSpec, tryExtractChromiumCookies } from "../src/cookie-extractor.js"

describe("parseSpec", () => {
	it("returns base + Default profile for bare name", () => {
		expect(parseSpec("chromium")).toEqual({ base: "chromium", profile: "Default" })
	})

	it("strips +keyring suffix", () => {
		expect(parseSpec("chromium+gnomekeyring")).toEqual({ base: "chromium", profile: "Default" })
	})

	it("picks up :profile", () => {
		expect(parseSpec("chromium:Profile 1")).toEqual({ base: "chromium", profile: "Profile 1" })
	})

	it("handles +keyring:profile combination", () => {
		expect(parseSpec("chromium+gnomekeyring:Work")).toEqual({ base: "chromium", profile: "Work" })
	})
})

describe("isExtracted", () => {
	it("identifies success result", () => {
		expect(isExtracted({ cookiesFile: "/tmp/x", count: 1, cleanup: () => {} })).toBe(true)
	})

	it("rejects failure result", () => {
		expect(isExtracted({ reason: "nope" })).toBe(false)
	})

	it("rejects null", () => {
		expect(isExtracted(null)).toBe(false)
	})
})

describe("tryExtractChromiumCookies", () => {
	function withPlatform<T>(name: NodeJS.Platform, fn: () => T): T {
		const original = Object.getOwnPropertyDescriptor(process, "platform")!
		Object.defineProperty(process, "platform", { value: name })
		try {
			return fn()
		} finally {
			Object.defineProperty(process, "platform", original)
		}
	}

	it("returns null when browser base is not Chromium-family on any platform", () => {
		// firefox isn't in BASE_BROWSERS — extractor must skip it regardless of platform.
		for (const platform of ["linux", "darwin", "win32"] as NodeJS.Platform[]) {
			withPlatform(platform, () => {
				expect(tryExtractChromiumCookies("firefox")).toBeNull()
				expect(tryExtractChromiumCookies("opera")).toBeNull()
			})
		}
	})

	it("returns null on unsupported platforms (e.g. freebsd)", () => {
		withPlatform("freebsd" as NodeJS.Platform, () => {
			expect(tryExtractChromiumCookies("chromium")).toBeNull()
		})
	})
})

describe("decryptChromiumCookie", () => {
	const password = "test-password"
	const key = pbkdf2Sync(password, "saltysalt", 1, 16, "sha1")
	const iv = Buffer.alloc(16, 0x20)

	function encrypt(plaintext: Buffer, version: "v10" | "v11", hashPrefix: Buffer | null): Buffer {
		const cipher = createCipheriv("aes-128-cbc", key, iv)
		const body = hashPrefix ? Buffer.concat([hashPrefix, plaintext]) : plaintext
		const ct = Buffer.concat([cipher.update(body), cipher.final()])
		return Buffer.concat([Buffer.from(version, "utf8"), ct])
	}

	it("returns null for empty/short ciphertext", () => {
		expect(decryptChromiumCookie(Buffer.alloc(0), key, iv, 0)).toBeNull()
		expect(decryptChromiumCookie(Buffer.from("v1"), key, iv, 0)).toBeNull()
	})

	it("returns null for unrecognised version prefix", () => {
		const ct = Buffer.concat([Buffer.from("vXX"), Buffer.alloc(16)])
		expect(decryptChromiumCookie(ct, key, iv, 0)).toBeNull()
	})

	it("decrypts v10 cookies (no hash prefix, meta < 24)", () => {
		const plaintext = Buffer.from("session-cookie-value")
		const ct = encrypt(plaintext, "v10", null)
		expect(decryptChromiumCookie(ct, key, iv, 0)).toBe("session-cookie-value")
	})

	it("decrypts v11 cookies (no hash prefix, meta < 24)", () => {
		const plaintext = Buffer.from("auth-token-12345")
		const ct = encrypt(plaintext, "v11", null)
		expect(decryptChromiumCookie(ct, key, iv, 0)).toBe("auth-token-12345")
	})

	it("strips 32-byte hash prefix on meta_version >= 24", () => {
		const host = ".youtube.com"
		const hash = createHash("sha256").update(host).digest() // 32 bytes
		const plaintext = Buffer.from("post-chrome-130-value")
		const ct = encrypt(plaintext, "v11", hash)
		expect(decryptChromiumCookie(ct, key, iv, 24)).toBe("post-chrome-130-value")
	})

	it("returns null when key is wrong (decryption succeeds but plaintext is garbage)", () => {
		const plaintext = Buffer.from("real-value")
		const ct = encrypt(plaintext, "v11", null)
		const wrongKey = pbkdf2Sync("different-password", "saltysalt", 1, 16, "sha1")
		// Wrong key typically yields invalid PKCS#7 padding → throws → null.
		// (If padding happens to validate, we'd return garbage bytes — that's
		// a tradeoff this function accepts; the cookies-file consumer would
		// then ignore them.)
		const result = decryptChromiumCookie(ct, wrongKey, iv, 0)
		// Either null (padding error) or non-matching string — never the original.
		expect(result).not.toBe("real-value")
	})
})
