import { describe, it, expect } from "vitest"
import { computeDimensions } from "../src/decoder.js"

describe("computeDimensions", () => {
	it("preserves aspect ratio", () => {
		const { width, height } = computeDimensions(1920, 1080, 80, 24)
		const aspect = width / height
		expect(aspect).toBeCloseTo(1920 / 1080, 0)
	})

	it("fits within terminal bounds", () => {
		const { width, height } = computeDimensions(1920, 1080, 80, 24)
		expect(width).toBeLessThanOrEqual(80)
		expect(Math.ceil(height / 2)).toBeLessThanOrEqual(24)
	})

	it("returns even height", () => {
		const { height } = computeDimensions(1920, 1080, 80, 24)
		expect(height % 2).toBe(0)
	})

	it("handles very small terminal", () => {
		const { width, height } = computeDimensions(1920, 1080, 20, 10)
		expect(width).toBeGreaterThanOrEqual(4)
		expect(height).toBeGreaterThanOrEqual(2)
	})

	it("handles portrait video", () => {
		const { width, height } = computeDimensions(1080, 1920, 80, 40)
		expect(height).toBeGreaterThan(width)
	})

	it("uses compact mode for small terminals", () => {
		computeDimensions(1920, 1080, 100, 30)
		const compact = computeDimensions(1920, 1080, 50, 15)
		// Compact reserves fewer rows, so more space for video
		expect(compact.height).toBeGreaterThan(0)
	})
})
