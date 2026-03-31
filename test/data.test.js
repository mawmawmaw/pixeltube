import { describe, it, expect } from "vitest"
import { formatDuration } from "../src/utils/time.js"

describe("formatDuration", () => {
	it("formats seconds correctly", () => {
		expect(formatDuration(65)).toBe("1:05")
	})

	it("formats hours correctly", () => {
		expect(formatDuration(3661)).toBe("1:01:01")
	})

	it("returns empty for zero", () => {
		expect(formatDuration(0)).toBe("")
	})

	it("returns empty for negative", () => {
		expect(formatDuration(-5)).toBe("")
	})

	it("handles string input", () => {
		expect(formatDuration("120")).toBe("2:00")
	})

	it("handles NaN input", () => {
		expect(formatDuration("abc")).toBe("")
	})
})
