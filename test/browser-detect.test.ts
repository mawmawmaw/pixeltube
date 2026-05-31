import { describe, it, expect, vi, beforeEach } from "vitest"

const existsSyncMock = vi.fn<(path: string) => boolean>()

vi.mock("node:fs", () => ({
	existsSync: (path: string) => existsSyncMock(path),
}))

const { detectBrowsers, isValidBrowser, BROWSER_PRIORITY } = await import("../src/browser-detect.js")

const presentPaths = (paths: string[]) => {
	const set = new Set(paths)
	existsSyncMock.mockImplementation((p: string) => set.has(p))
}

describe("isValidBrowser", () => {
	it("accepts known browser names", () => {
		for (const name of BROWSER_PRIORITY) expect(isValidBrowser(name)).toBe(true)
	})

	it("rejects unknown browser names", () => {
		expect(isValidBrowser("opera")).toBe(false)
		expect(isValidBrowser("")).toBe(false)
		expect(isValidBrowser("Chrome")).toBe(false) // case-sensitive
	})
})

describe("detectBrowsers", () => {
	beforeEach(() => {
		existsSyncMock.mockReset()
		existsSyncMock.mockReturnValue(false)
	})

	it("returns empty when nothing exists", () => {
		const result = detectBrowsers("linux", { HOME: "/home/u" })
		expect(result.available).toEqual([])
		expect(result.preferred).toBeNull()
	})

	it("returns empty on unsupported platform", () => {
		existsSyncMock.mockReturnValue(true)
		const result = detectBrowsers("freebsd" as NodeJS.Platform, { HOME: "/home/u" })
		expect(result.available).toEqual([])
		expect(result.preferred).toBeNull()
	})

	it("returns empty when HOME is unset on linux", () => {
		existsSyncMock.mockReturnValue(true)
		const result = detectBrowsers("linux", {})
		expect(result.available).toEqual([])
		expect(result.preferred).toBeNull()
	})

	describe("linux", () => {
		const env = { HOME: "/home/u" }

		it("detects chrome", () => {
			presentPaths(["/home/u/.config/google-chrome"])
			const result = detectBrowsers("linux", env)
			expect(result.available).toEqual(["chrome"])
			expect(result.preferred).toBe("chrome")
		})

		it("detects chromium when chrome absent", () => {
			presentPaths(["/home/u/.config/chromium"])
			const result = detectBrowsers("linux", env)
			expect(result.preferred).toBe("chromium")
		})

		it("prefers chrome over chromium when both present", () => {
			presentPaths(["/home/u/.config/google-chrome", "/home/u/.config/chromium"])
			const result = detectBrowsers("linux", env)
			expect(result.available).toEqual(["chrome", "chromium"])
			expect(result.preferred).toBe("chrome")
		})

		it("detects firefox", () => {
			presentPaths(["/home/u/.mozilla/firefox"])
			expect(detectBrowsers("linux", env).preferred).toBe("firefox")
		})

		it("detects brave and edge in priority order", () => {
			presentPaths(["/home/u/.config/BraveSoftware/Brave-Browser", "/home/u/.config/microsoft-edge"])
			const result = detectBrowsers("linux", env)
			expect(result.available).toEqual(["brave", "edge"])
			expect(result.preferred).toBe("brave")
		})
	})

	describe("macOS", () => {
		const env = { HOME: "/Users/u" }

		it("detects chrome", () => {
			presentPaths(["/Users/u/Library/Application Support/Google/Chrome"])
			expect(detectBrowsers("darwin", env).preferred).toBe("chrome")
		})

		it("detects firefox", () => {
			presentPaths(["/Users/u/Library/Application Support/Firefox"])
			expect(detectBrowsers("darwin", env).preferred).toBe("firefox")
		})
	})

	describe("windows", () => {
		const env = { LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local", APPDATA: "C:\\Users\\u\\AppData\\Roaming" }

		it("detects chrome via LOCALAPPDATA", () => {
			presentPaths(["C:\\Users\\u\\AppData\\Local\\Google\\Chrome\\User Data"])
			expect(detectBrowsers("win32", env).preferred).toBe("chrome")
		})

		it("detects firefox via APPDATA", () => {
			presentPaths(["C:\\Users\\u\\AppData\\Roaming\\Mozilla\\Firefox"])
			expect(detectBrowsers("win32", env).preferred).toBe("firefox")
		})

		it("returns empty when env vars missing", () => {
			existsSyncMock.mockReturnValue(true)
			expect(detectBrowsers("win32", {}).preferred).toBeNull()
		})
	})
})
