import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Screen } from "../src/tui/buffer.js"
import { stripAnsi } from "../src/tui/width.js"

// Silence the real stdout writes flush() performs.
beforeEach(() => {
	vi.spyOn(process.stdout, "write").mockImplementation(() => true)
})
afterEach(() => {
	vi.restoreAllMocks()
})

describe("Screen.put + flush", () => {
	it("emits written text on first flush", () => {
		const s = new Screen(10, 2)
		s.put(0, 0, "hello")
		const out = s.flush()
		expect(stripAnsi(out)).toContain("hello")
	})

	it("emits nothing when nothing changed between flushes", () => {
		const s = new Screen(10, 2)
		s.put(0, 0, "hello")
		s.flush()
		const second = s.flush()
		// No cell changed -> only (empty) sync escapes remain.
		expect(stripAnsi(second)).toBe("")
	})

	it("emits only the changed cell on incremental update", () => {
		const s = new Screen(10, 1)
		s.put(0, 0, "hello")
		s.flush()
		s.put(0, 0, "hellp") // change only the last char
		const out = s.flush()
		const visible = stripAnsi(out)
		expect(visible).toContain("p")
		expect(visible).not.toContain("hell") // unchanged prefix not re-emitted
	})

	it("strips embedded ANSI into per-cell style but renders the glyphs", () => {
		const s = new Screen(10, 1)
		s.put(0, 0, "\x1b[1mhi\x1b[0m")
		const out = s.flush()
		expect(stripAnsi(out)).toContain("hi")
		expect(out).toContain("\x1b[1m")
	})
})

describe("Screen wide glyphs", () => {
	it("renders a wide glyph once without doubling", () => {
		const s = new Screen(10, 1)
		s.put(0, 0, "中a")
		const out = stripAnsi(s.flush())
		expect(out).toContain("中a")
		// the wide glyph appears exactly once
		expect(out.split("中").length - 1).toBe(1)
	})
})

describe("Screen.fill / clear", () => {
	it("clear blanks previously written content", () => {
		const s = new Screen(6, 1)
		s.put(0, 0, "abcdef")
		s.flush()
		s.clear()
		const out = stripAnsi(s.flush())
		expect(out).not.toContain("abcdef")
	})
})

describe("Screen.resize", () => {
	it("forces a full repaint after resize", () => {
		const s = new Screen(10, 1)
		s.put(0, 0, "hello")
		s.flush()
		s.flush() // now fully diffed (empty)
		s.resize(10, 1)
		s.put(0, 0, "hello")
		const out = stripAnsi(s.flush())
		expect(out).toContain("hello")
	})
})

describe("Screen origin offset", () => {
	it("maps local row 0 to the terminal region origin", () => {
		const s = new Screen(10, 3, 0, 1) // content region starting at terminal row 2
		s.put(0, 0, "x")
		const out = s.flush()
		expect(out).toContain("\x1b[2;1H") // local (0,0) -> terminal row 2, col 1
	})
})

describe("Screen.setCursor", () => {
	it("shows the hardware cursor at the requested position", () => {
		const s = new Screen(10, 2)
		s.put(0, 0, "x")
		s.setCursor(3, 1)
		const out = s.flush()
		expect(out).toContain("\x1b[2;4H") // row 2, col 4 (1-based)
		expect(out).toContain("\x1b[?25h")
	})
})
