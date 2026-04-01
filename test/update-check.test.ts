import { describe, it, expect } from "vitest"
import { isNewer, getInstallMethod, VERSION } from "../src/cli/update-check.js"
import { parseArgs } from "../src/cli/args.js"

describe("isNewer", () => {
	it("detects newer patch version", () => {
		expect(isNewer("0.0.7", "0.0.8")).toBe(true)
	})

	it("detects newer minor version", () => {
		expect(isNewer("0.0.9", "0.1.0")).toBe(true)
	})

	it("detects newer major version", () => {
		expect(isNewer("0.9.9", "1.0.0")).toBe(true)
	})

	it("returns false for older version", () => {
		expect(isNewer("0.0.8", "0.0.7")).toBe(false)
	})

	it("returns false for equal versions", () => {
		expect(isNewer("0.0.7", "0.0.7")).toBe(false)
	})

	it("returns false when current is higher minor", () => {
		expect(isNewer("0.1.0", "0.0.9")).toBe(false)
	})
})

describe("VERSION", () => {
	it("reads version from package.json", () => {
		expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/)
	})
})

describe("getInstallMethod", () => {
	it("returns npm by default in dev/test environment", () => {
		expect(getInstallMethod()).toBe("npm")
	})
})

describe("parseArgs --version", () => {
	it("handles --version flag", () => {
		const result = parseArgs(["node", "pixeltube", "--version"])
		expect(result.subcommand).toBe("version")
	})

	it("handles -V flag", () => {
		const result = parseArgs(["node", "pixeltube", "-V"])
		expect(result.subcommand).toBe("version")
	})

	it("handles --version anywhere in args", () => {
		const result = parseArgs(["node", "pixeltube", "video.mp4", "--version"])
		expect(result.subcommand).toBe("version")
	})
})
