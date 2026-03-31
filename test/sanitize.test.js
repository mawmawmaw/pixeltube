import { describe, it, expect } from "vitest"
import { sanitize } from "../src/utils/sanitize.js"

describe("sanitize", () => {
	it("returns empty string for null/undefined", () => {
		expect(sanitize(null)).toBe("")
		expect(sanitize(undefined)).toBe("")
		expect(sanitize("")).toBe("")
	})

	it("passes through normal text", () => {
		expect(sanitize("Hello World")).toBe("Hello World")
	})

	it("strips ANSI color codes", () => {
		expect(sanitize("\x1b[31mred\x1b[0m")).toBe("red")
	})

	it("strips ANSI cursor/screen codes", () => {
		expect(sanitize("\x1b[2Jcleared")).toBe("cleared")
	})

	it("strips OSC sequences (title injection)", () => {
		expect(sanitize("\x1b]0;evil title\x07normal")).toBe("normal")
	})

	it("strips control characters", () => {
		expect(sanitize("hello\x00\x01\x7fworld")).toBe("helloworld")
	})

	it("preserves unicode", () => {
		expect(sanitize("ちぃたん☆")).toBe("ちぃたん☆")
	})
})
