import { describe, it, expect } from "vitest"
import { parseArgs, cookieArgsFromOptions, validateOptions } from "../src/cli/args.js"

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

	it("returns null input when no args", () => {
		const result = parseArgs(["node", "pixeltube"])
		expect(result.input).toBeNull()
		expect(result.subcommand).toBeNull()
	})
})

describe("cookieArgsFromOptions", () => {
	it("returns browser cookies by default", () => {
		expect(cookieArgsFromOptions({})).toEqual(["--cookies-from-browser", "chrome"])
	})

	it("returns file cookies when specified", () => {
		expect(cookieArgsFromOptions({ cookies: "/tmp/c.txt" })).toEqual(["--cookies", "/tmp/c.txt"])
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
})
