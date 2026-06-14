import { describe, it, expect } from "vitest"
import {
	formatViews,
	formatLikes,
	formatSubscribers,
	formatUploadDate,
	compactCount,
	formatVideoItem,
} from "../src/browse/format.js"
import { displayWidth } from "../src/tui/width.js"
import type { Video } from "../src/types.js"

describe("formatViews", () => {
	it("formats compact counts", () => {
		expect(formatViews(999)).toBe("999 views")
		expect(formatViews(1500)).toBe("1.5K views")
		expect(formatViews(2_400_000)).toBe("2.4M views")
		expect(formatViews(3_000_000_000)).toBe("3B views")
	})
	it("returns empty for missing or zero", () => {
		expect(formatViews(undefined)).toBe("")
		expect(formatViews(0)).toBe("")
	})
})

describe("compactCount", () => {
	it("formats magnitudes without a suffix", () => {
		expect(compactCount(999)).toBe("999")
		expect(compactCount(1500)).toBe("1.5K")
		expect(compactCount(2_400_000)).toBe("2.4M")
		expect(compactCount(3_000_000_000)).toBe("3B")
	})
	it("returns empty for missing or zero", () => {
		expect(compactCount(undefined)).toBe("")
		expect(compactCount(0)).toBe("")
	})
})

describe("formatLikes / formatSubscribers", () => {
	it("appends the right noun", () => {
		expect(formatLikes(250_000)).toBe("250K likes")
		expect(formatSubscribers(1_200_000)).toBe("1.2M subscribers")
	})
	it("returns empty for missing values", () => {
		expect(formatLikes(undefined)).toBe("")
		expect(formatSubscribers(0)).toBe("")
	})
})

describe("formatUploadDate", () => {
	it("renders relative time from a unix timestamp", () => {
		const now = Date.now()
		const twoDaysAgo = Math.floor((now - 2 * 86400000) / 1000)
		expect(formatUploadDate(twoDaysAgo)).toBe("2 days ago")
		const oneYearAgo = Math.floor((now - 400 * 86400000) / 1000)
		expect(formatUploadDate(oneYearAgo)).toBe("1 year ago")
	})
	it("falls back to a YYYYMMDD upload date", () => {
		expect(formatUploadDate(undefined, "20200101")).toContain("ago")
	})
	it("returns empty when nothing usable is given", () => {
		expect(formatUploadDate(undefined, undefined)).toBe("")
		expect(formatUploadDate(0, "bad")).toBe("")
	})
})

describe("formatVideoItem", () => {
	const v: Video = {
		id: "x",
		title: "A reasonably long video title here",
		channel: "Chan",
		duration: 0,
		durationFmt: "10:00",
		views: 1_200_000,
	}

	it("stays within the given width", () => {
		const out = formatVideoItem(v, 50)
		expect(displayWidth(out)).toBeLessThanOrEqual(50)
	})
	it("includes the views and duration metadata", () => {
		const out = formatVideoItem(v, 60)
		expect(out).toContain("1.2M views")
		expect(out).toContain("10:00")
	})
	it("truncates a long title to fit", () => {
		const out = formatVideoItem({ ...v, title: "x".repeat(200) }, 30)
		expect(displayWidth(out)).toBeLessThanOrEqual(30)
	})
})
