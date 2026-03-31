import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { parseSrt, findSub } from "../src/utils/srt.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const sampleSrt = readFileSync(join(__dirname, "fixtures/sample.srt"), "utf8")

describe("parseSrt", () => {
	it("parses sample SRT file", () => {
		const subs = parseSrt(sampleSrt)
		expect(subs.length).toBe(4)
	})

	it("extracts correct timestamps", () => {
		const subs = parseSrt(sampleSrt)
		expect(subs[0].start).toBeCloseTo(0.32, 1)
		expect(subs[0].end).toBeCloseTo(14.58, 1)
	})

	it("extracts text content", () => {
		const subs = parseSrt(sampleSrt)
		expect(subs[1].text).toBe("We're no strangers to love")
	})

	it("joins multi-line subtitles", () => {
		const subs = parseSrt(sampleSrt)
		expect(subs[3].text).toBe("Never gonna give you up Never gonna let you down")
	})

	it("strips HTML tags", () => {
		const srt = "1\n00:00:00,000 --> 00:00:01,000\n<i>italic</i> <b>bold</b>\n"
		const subs = parseSrt(srt)
		expect(subs[0].text).toBe("italic bold")
	})

	it("handles empty input", () => {
		expect(parseSrt("")).toEqual([])
	})

	it("skips malformed entries", () => {
		const srt = "1\nbad timestamp\nsome text\n\n2\n00:00:01,000 --> 00:00:02,000\ngood\n"
		const subs = parseSrt(srt)
		expect(subs.length).toBe(1)
		expect(subs[0].text).toBe("good")
	})
})

describe("findSub", () => {
	const subs = [
		{ start: 0, end: 5, text: "first" },
		{ start: 10, end: 15, text: "second" },
	]

	it("finds subtitle at given time", () => {
		expect(findSub(subs, 3)).toBe("first")
		expect(findSub(subs, 12)).toBe("second")
	})

	it("returns null between subtitles", () => {
		expect(findSub(subs, 7)).toBeNull()
	})

	it("returns null before first subtitle", () => {
		expect(findSub(subs, -1)).toBeNull()
	})

	it("returns null after last subtitle", () => {
		expect(findSub(subs, 20)).toBeNull()
	})
})
