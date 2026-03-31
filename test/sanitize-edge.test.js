import { describe, it, expect } from "vitest"
import { sanitize } from "../src/utils/sanitize.js"

describe("sanitize edge cases", () => {
	it("handles emoji", () => {
		expect(sanitize("Hello 🎵🎶 World")).toBe("Hello 🎵🎶 World")
	})

	it("handles CJK characters", () => {
		expect(sanitize("日本語テスト")).toBe("日本語テスト")
	})

	it("handles RTL text", () => {
		expect(sanitize("مرحبا بالعالم")).toBe("مرحبا بالعالم")
	})

	it("handles very long strings", () => {
		const long = "a".repeat(10000)
		expect(sanitize(long)).toBe(long)
	})

	it("strips nested ANSI codes", () => {
		expect(sanitize("\x1b[1m\x1b[31mbold red\x1b[0m")).toBe("bold red")
	})

	it("strips title injection via OSC", () => {
		expect(sanitize("normal\x1b]0;HACKED\x07text")).toBe("normaltext")
	})

	it("strips bell character", () => {
		expect(sanitize("ding\x07dong")).toBe("dingdong")
	})

	it("preserves tabs and newlines", () => {
		expect(sanitize("line1\nline2\ttab")).toBe("line1\nline2\ttab")
	})

	it("handles mixed safe and unsafe content", () => {
		expect(sanitize("Hello \x1b[31m\x00World\x1b[0m!")).toBe("Hello World!")
	})
})
