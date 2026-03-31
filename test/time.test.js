import { describe, it, expect } from "vitest"
import { formatTime, formatDuration } from "../src/utils/time.js"

describe("formatTime", () => {
	it("formats seconds", () => {
		expect(formatTime(5)).toBe("0:05")
	})

	it("formats minutes and seconds", () => {
		expect(formatTime(65)).toBe("1:05")
	})

	it("formats hours", () => {
		expect(formatTime(3661)).toBe("1:01:01")
	})

	it("handles zero", () => {
		expect(formatTime(0)).toBe("0:00")
	})

	it("handles negative", () => {
		expect(formatTime(-5)).toBe("0:00")
	})
})

describe("formatDuration", () => {
	it("formats numeric seconds", () => {
		expect(formatDuration(120)).toBe("2:00")
	})

	it("formats string input", () => {
		expect(formatDuration("3600")).toBe("1:00:00")
	})

	it("returns empty for zero", () => {
		expect(formatDuration(0)).toBe("")
	})

	it("returns empty for NaN", () => {
		expect(formatDuration("abc")).toBe("")
	})
})
