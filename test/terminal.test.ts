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
