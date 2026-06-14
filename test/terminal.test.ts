import { describe, it, expect } from "vitest"
import { parseKey } from "../src/tui/terminal.js"

describe("parseKey", () => {
	it("parses ctrl-c", () => {
		expect(parseKey("\x03")).toBe("ctrl-c")
	})

	it("parses escape", () => {
		expect(parseKey("\x1b")).toBe("escape")
	})

	it("parses enter", () => {
		expect(parseKey("\r")).toBe("enter")
	})

	it("parses backspace", () => {
		expect(parseKey("\x7f")).toBe("backspace")
		expect(parseKey("\b")).toBe("backspace")
	})

	it("parses mouse wheel up/down (SGR)", () => {
		expect(parseKey("\x1b[<64;10;5M")).toBe("scroll-up")
		expect(parseKey("\x1b[<65;10;5M")).toBe("scroll-down")
	})

	it("ignores mouse clicks/release events", () => {
		expect(parseKey("\x1b[<0;10;5M")).toBeNull()
		expect(parseKey("\x1b[<0;10;5m")).toBeNull()
	})

	it("parses arrow keys", () => {
		expect(parseKey("\x1b[A")).toBe("up")
		expect(parseKey("\x1b[B")).toBe("down")
		expect(parseKey("\x1b[C")).toBe("right")
		expect(parseKey("\x1b[D")).toBe("left")
	})

	it("parses tab", () => {
		expect(parseKey("\t")).toBe("tab")
	})

	it("parses printable characters", () => {
		expect(parseKey("a")).toBe("a")
		expect(parseKey("Z")).toBe("z")
		expect(parseKey("5")).toBe("5")
		expect(parseKey(" ")).toBe(" ")
		expect(parseKey("~")).toBe("~")
	})

	it("returns null for unknown sequences", () => {
		expect(parseKey("\x1b[99~")).toBeNull()
		expect(parseKey("\x00")).toBeNull()
	})
})
