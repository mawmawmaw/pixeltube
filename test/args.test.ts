import { describe, it, expect, vi, beforeEach } from "vitest"

const detectBrowsersMock = vi.fn<() => { available: string[]; preferred: string | null }>()

vi.mock("../src/browser-detect.js", async () => {
	const actual = await vi.importActual<typeof import("../src/browser-detect.js")>("../src/browser-detect.js")
	return {
		...actual,
		detectBrowsers: () => detectBrowsersMock(),
	}
})

const { parseArgs, cookieArgsFromOptions, validateOptions } = await import("../src/cli/args.js")

beforeEach(() => {
	detectBrowsersMock.mockReset()
	detectBrowsersMock.mockReturnValue({ available: [], preferred: null })
})

describe("parseArgs", () => {
	it("parses help subcommand", () => {
		expect(parseArgs(["node", "pixeltube", "help"]).subcommand).toBe("help")
		expect(parseArgs(["node", "pixeltube", "--help"]).subcommand).toBe("help")
		expect(parseArgs(["node", "pixeltube", "-h"]).subcommand).toBe("help")
	})

	it("parses login subcommand", () => {
		expect(parseArgs(["node", "pixeltube", "login"]).subcommand).toBe("login")
	})

	it("parses browse subcommand", () => {
		expect(parseArgs(["node", "pixeltube", "browse"]).subcommand).toBe("browse")
	})

	it("parses video file input", () => {
		const result = parseArgs(["node", "pixeltube", "video.mp4"])
		expect(result.input).toBe("video.mp4")
		expect(result.subcommand).toBeNull()
	})

	it("parses URL input", () => {
		const result = parseArgs(["node", "pixeltube", "https://youtu.be/abc"])
		expect(result.input).toBe("https://youtu.be/abc")
	})

	it("parses --fps option", () => {
		const result = parseArgs(["node", "pixeltube", "video.mp4", "--fps", "24"])
		expect(result.options.fps).toBe(24)
	})

	it("parses --scale option", () => {
		const result = parseArgs(["node", "pixeltube", "video.mp4", "-s", "0.5"])
		expect(result.options.scale).toBe(0.5)
	})

	it("parses --dl flag", () => {
		const result = parseArgs(["node", "pixeltube", "video.mp4", "--dl"])
		expect(result.options.download).toBe(true)
	})

	it("parses --no-audio flag", () => {
		const result = parseArgs(["node", "pixeltube", "video.mp4", "--no-audio"])
		expect(result.options.audio).toBe(false)
	})

	it("parses --cookies option", () => {
		const result = parseArgs(["node", "pixeltube", "video.mp4", "--cookies", "/tmp/cookies.txt"])
		expect(result.options.cookies).toBe("/tmp/cookies.txt")
	})

	it("parses cookies with browse", () => {
		const result = parseArgs(["node", "pixeltube", "browse", "--cookies", "/tmp/cookies.txt"])
		expect(result.subcommand).toBe("browse")
		expect(result.options.cookies).toBe("/tmp/cookies.txt")
	})

	it("parses --browser option", () => {
		const result = parseArgs(["node", "pixeltube", "video.mp4", "--browser", "firefox"])
		expect(result.options.browser).toBe("firefox")
	})

	it("parses --browser with browse subcommand", () => {
		const result = parseArgs(["node", "pixeltube", "browse", "--browser", "chromium"])
		expect(result.subcommand).toBe("browse")
		expect(result.options.browser).toBe("chromium")
	})

	it("parses --browser with login subcommand", () => {
		const result = parseArgs(["node", "pixeltube", "login", "--browser", "brave"])
		expect(result.subcommand).toBe("login")
		expect(result.options.browser).toBe("brave")
	})

	it("returns null input when no args", () => {
		const result = parseArgs(["node", "pixeltube"])
		expect(result.input).toBeNull()
		expect(result.subcommand).toBeNull()
	})
})

describe("cookieArgsFromOptions", () => {
	it("returns file cookies when specified", () => {
		expect(cookieArgsFromOptions({ cookies: "/tmp/c.txt" })).toEqual(["--cookies", "/tmp/c.txt"])
	})

	it("returns browser cookies when --browser is specified", () => {
		expect(cookieArgsFromOptions({ browser: "firefox" })).toEqual(["--cookies-from-browser", "firefox"])
	})

	it("prefers --cookies over --browser", () => {
		expect(cookieArgsFromOptions({ cookies: "/tmp/c.txt", browser: "chrome" })).toEqual(["--cookies", "/tmp/c.txt"])
	})

	it("falls back to detected browser when no flags set", () => {
		detectBrowsersMock.mockReturnValue({ available: ["chromium"], preferred: "chromium" })
		expect(cookieArgsFromOptions({})).toEqual(["--cookies-from-browser", "chromium"])
	})

	it("returns empty array when nothing detected", () => {
		detectBrowsersMock.mockReturnValue({ available: [], preferred: null })
		expect(cookieArgsFromOptions({})).toEqual([])
	})
})

describe("validateOptions", () => {
	it("returns empty for valid options", () => {
		expect(validateOptions({ scale: 1.0 })).toEqual([])
	})

	it("catches invalid fps", () => {
		const errors = validateOptions({ fps: -1 })
		expect(errors.length).toBe(1)
		expect(errors[0]).toContain("fps")
	})

	it("catches invalid scale", () => {
		const errors = validateOptions({ scale: 0 })
		expect(errors.length).toBe(1)
		expect(errors[0]).toContain("scale")
	})

	it("catches invalid --browser value", () => {
		const errors = validateOptions({ browser: "opera" })
		expect(errors.length).toBe(1)
		expect(errors[0]).toContain("--browser")
	})

	it("accepts valid --browser value", () => {
		expect(validateOptions({ browser: "firefox" })).toEqual([])
	})

	it("accepts --browser with keyring suffix", () => {
		expect(validateOptions({ browser: "chromium+gnomekeyring" })).toEqual([])
	})

	it("accepts --browser with profile", () => {
		expect(validateOptions({ browser: "chrome:Default" })).toEqual([])
	})

	it("accepts --browser with keyring and profile", () => {
		expect(validateOptions({ browser: "chromium+gnomekeyring:Profile1" })).toEqual([])
	})

	it("rejects --browser when base name is invalid", () => {
		const errors = validateOptions({ browser: "opera+gnomekeyring" })
		expect(errors.length).toBe(1)
		expect(errors[0]).toContain("--browser")
	})
})
