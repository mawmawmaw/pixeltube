import { describe, it, expect } from "vitest"
import { center, centerX, stack, inset, splitTop, splitBottom } from "../src/tui/layout.js"

const root = { x: 0, y: 0, w: 80, h: 24 }

describe("center", () => {
	it("centers a smaller rect", () => {
		expect(center(root, 20, 4)).toEqual({ x: 30, y: 10, w: 20, h: 4 })
	})
	it("clamps to the outer bounds", () => {
		expect(center(root, 100, 100)).toEqual({ x: 0, y: 0, w: 80, h: 24 })
	})
})

describe("centerX", () => {
	it("centers horizontally at the given y", () => {
		expect(centerX(root, 10, 5)).toEqual({ x: 35, y: 5, w: 10, h: 1 })
	})
})

describe("stack", () => {
	it("produces single-row slots", () => {
		const slots = stack({ x: 2, y: 3, w: 10, h: 5 }, 3)
		expect(slots).toEqual([
			{ x: 2, y: 3, w: 10, h: 1 },
			{ x: 2, y: 4, w: 10, h: 1 },
			{ x: 2, y: 5, w: 10, h: 1 },
		])
	})
	it("applies spacing between slots", () => {
		const slots = stack({ x: 0, y: 0, w: 4, h: 9 }, 3, 1)
		expect(slots.map((s) => s.y)).toEqual([0, 2, 4])
	})
})

describe("inset", () => {
	it("shrinks on all sides", () => {
		expect(inset(root, 2)).toEqual({ x: 2, y: 2, w: 76, h: 20 })
	})
})

describe("split", () => {
	it("splitTop carves the top n rows", () => {
		const [top, rest] = splitTop(root, 1)
		expect(top).toEqual({ x: 0, y: 0, w: 80, h: 1 })
		expect(rest).toEqual({ x: 0, y: 1, w: 80, h: 23 })
	})
	it("splitBottom carves the bottom n rows", () => {
		const [rest, bottom] = splitBottom(root, 1)
		expect(rest).toEqual({ x: 0, y: 0, w: 80, h: 23 })
		expect(bottom).toEqual({ x: 0, y: 23, w: 80, h: 1 })
	})
})
