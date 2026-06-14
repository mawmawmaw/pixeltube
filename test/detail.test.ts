import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { VideoDetail } from "../src/types.js"

// Mock the thumbnail loader so the detail pane exercises the half-block path
// without any network or ffmpeg.
vi.mock("../src/browse/thumbnail.js", () => ({
	getCachedThumbnail: () => Buffer.alloc(200_000, 90),
	thumbnailFailed: () => false,
	loadThumbnail: vi.fn(() => Promise.resolve(null)),
}))

// Mock the lazy detail loader so no yt-dlp runs. `cachedDetail` lets individual
// tests pretend the extra metadata has already arrived.
let cachedDetail: VideoDetail | null = null
vi.mock("../src/browse/video-detail.js", () => ({
	getCachedVideoDetail: () => cachedDetail,
	videoDetailFailed: () => false,
	loadVideoDetail: vi.fn(() => Promise.resolve(null)),
}))

import { createDetailPane } from "../src/tui/components/detail.js"
import { Screen } from "../src/tui/buffer.js"
import { stripAnsi } from "../src/tui/width.js"

beforeEach(() => {
	cachedDetail = null
	vi.spyOn(process.stdout, "write").mockImplementation(() => true)
})
afterEach(() => vi.restoreAllMocks())

const item = {
	id: "abc123",
	title: "Cool Video About Things",
	channel: "Some Channel",
	durationFmt: "12:34",
	views: 4_500_000,
}

describe("detail pane", () => {
	it("renders a bordered pane with title, channel and metadata", () => {
		const pane = createDetailPane()
		const buf = new Screen(40, 20)
		pane.render(item, buf, { x: 0, y: 0, w: 40, h: 20 }, false)
		const out = stripAnsi(buf.flush())
		expect(out).toContain("Cool Video About Things")
		expect(out).toContain("Some Channel")
		expect(out).toContain("4.5M views")
		expect(out).toContain("┌") // box border
	})

	it("draws half-block pixels when a thumbnail is cached", () => {
		const pane = createDetailPane()
		const buf = new Screen(40, 20)
		pane.render(item, buf, { x: 0, y: 0, w: 40, h: 20 }, false)
		const raw = buf.flush()
		expect(raw).toContain("▄") // half-block glyph from the thumbnail
	})

	it("handles a null item without throwing", () => {
		const pane = createDetailPane()
		const buf = new Screen(40, 20)
		expect(() => pane.render(null, buf, { x: 0, y: 0, w: 40, h: 20 }, false)).not.toThrow()
	})

	it("renders lazily-fetched detail: likes, subscribers, upload date and description", () => {
		cachedDetail = {
			likes: 250_000,
			subscribers: 1_200_000,
			timestamp: Math.floor(Date.UTC(2020, 0, 1) / 1000),
			description: "An unmistakable description sentence.",
		}
		const pane = createDetailPane()
		const buf = new Screen(50, 24)
		pane.render(item, buf, { x: 0, y: 0, w: 50, h: 24 }, false)
		const out = stripAnsi(buf.flush())
		expect(out).toContain("250K likes")
		expect(out).toContain("1.2M subscribers")
		expect(out).toContain("ago") // relative upload date
		expect(out).toContain("An unmistakable description")
	})

	it("backfills views from detail when the list row lacks them", () => {
		cachedDetail = { views: 8_300_000 }
		const pane = createDetailPane()
		const buf = new Screen(50, 24)
		pane.render({ ...item, views: undefined }, buf, { x: 0, y: 0, w: 50, h: 24 }, false)
		const out = stripAnsi(buf.flush())
		expect(out).toContain("8.3M views")
	})

	it("shows a loading hint while the extra metadata is still in flight", () => {
		cachedDetail = null // not yet loaded
		const pane = createDetailPane()
		const buf = new Screen(50, 24)
		pane.render(item, buf, { x: 0, y: 0, w: 50, h: 24 }, false)
		const out = stripAnsi(buf.flush())
		expect(out).toContain("loading info…")
	})

	it("hides the loading hint once detail has arrived", () => {
		cachedDetail = { likes: 10 }
		const pane = createDetailPane()
		const buf = new Screen(50, 24)
		pane.render(item, buf, { x: 0, y: 0, w: 50, h: 24 }, false)
		const out = stripAnsi(buf.flush())
		expect(out).not.toContain("loading info…")
	})

	it("backfills the channel name from detail when the list row lacks it", () => {
		cachedDetail = { channel: "Backfilled Channel" }
		const pane = createDetailPane()
		const buf = new Screen(50, 24)
		pane.render({ ...item, channel: "" }, buf, { x: 0, y: 0, w: 50, h: 24 }, false)
		const out = stripAnsi(buf.flush())
		expect(out).toContain("Backfilled Channel")
	})
})
