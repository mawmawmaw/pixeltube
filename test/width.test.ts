import { describe, it, expect } from "vitest"
import { stripAnsi, charWidth, displayWidth, truncate } from "../src/tui/width.js"

describe("stripAnsi", () => {
	it("removes SGR sequences", () => {
		expect(stripAnsi("\x1b[1m\x1b[93mhi\x1b[0m")).toBe("hi")
	})
	it("leaves plain text untouched", () => {
		expect(stripAnsi("plain")).toBe("plain")
	})
})

describe("charWidth", () => {
	it("normal ASCII is width 1", () => {
		expect(charWidth("a".codePointAt(0)!)).toBe(1)
	})
	it("CJK is width 2", () => {
		expect(charWidth("中".codePointAt(0)!)).toBe(2)
	})
	it("combining marks are width 0", () => {
		expect(charWidth(0x0301)).toBe(0)
	})
	it("emoji is width 2", () => {
		expect(charWidth("😀".codePointAt(0)!)).toBe(2)
	})
})

describe("displayWidth", () => {
	it("ignores ANSI codes", () => {
		expect(displayWidth("\x1b[1mhello\x1b[0m")).toBe(5)
	})
	it("counts wide chars as 2", () => {
		expect(displayWidth("中文")).toBe(4)
	})
	it("mixes narrow and wide", () => {
		expect(displayWidth("a中b")).toBe(4)
	})
})

describe("truncate", () => {
	it("returns input when it fits", () => {
		expect(truncate("hello", 10)).toBe("hello")
	})
	it("truncates and adds ellipsis", () => {
		expect(truncate("hello world", 7)).toBe("hello …")
	})
	it("measures by display width, not char count", () => {
		// 3 wide chars = width 6; max 5 -> keep 2 wide (width 4) + ellipsis
		expect(displayWidth(truncate("中文字", 5))).toBeLessThanOrEqual(5)
	})
	it("appends a reset when ANSI was present", () => {
		const out = truncate("\x1b[1mhello world\x1b[0m", 7)
		expect(out).toContain("\x1b[0m")
	})
	it("returns empty for non-positive max", () => {
		expect(truncate("anything", 0)).toBe("")
	})
})
