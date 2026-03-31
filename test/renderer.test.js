import { describe, it, expect, beforeEach } from "vitest"
import { renderFrame, resetRenderer } from "../src/renderer.js"

describe("renderFrame", () => {
	beforeEach(() => {
		resetRenderer()
	})

	it("returns a string with escape sequences", () => {
		const w = 4
		const h = 2
		const buf = Buffer.alloc(w * h * 3, 128)
		const result = renderFrame(buf, w, h)
		expect(typeof result).toBe("string")
		expect(result.length).toBeGreaterThan(0)
	})

	it("contains half-block characters", () => {
		const w = 2
		const h = 2
		const buf = Buffer.alloc(w * h * 3, 64)
		const result = renderFrame(buf, w, h)
		expect(result).toContain("▄")
	})

	it("skips row when skipRow is set", () => {
		const w = 4
		const h = 4
		const buf = Buffer.alloc(w * h * 3, 100)
		const result = renderFrame(buf, w, h, 1, 1, 0)
		// Row 0 should be skipped — output should only contain row 1 cursor positions
		expect(result).not.toContain("\x1b[1;")
	})

	it("second render uses diff optimization", () => {
		const w = 2
		const h = 2
		const buf = Buffer.alloc(w * h * 3, 200)
		renderFrame(buf, w, h)
		const second = renderFrame(buf, w, h)
		// Same frame — no half-blocks needed (all diffed out)
		expect(second).not.toContain("▄")
	})

	it("detects changes after reset", () => {
		const w = 2
		const h = 2
		const buf = Buffer.alloc(w * h * 3, 200)
		renderFrame(buf, w, h)
		resetRenderer()
		const result = renderFrame(buf, w, h)
		expect(result).toContain("▄")
	})
})
