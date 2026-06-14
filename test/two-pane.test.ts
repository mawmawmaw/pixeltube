import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("../src/browse/thumbnail.js", () => ({
	getCachedThumbnail: () => null,
	thumbnailFailed: () => true, // force the "no preview" placeholder, no async
	loadThumbnail: vi.fn(() => Promise.resolve(null)),
}))

import { createListView } from "../src/tui/list-view.js"
import { stripAnsi } from "../src/tui/width.js"
import { formatVideoItem } from "../src/browse/format.js"

const origCols = (process.stdout as { columns?: number }).columns
const origRows = (process.stdout as { rows?: number }).rows

function setDims(cols: number, rows: number) {
	;(process.stdout as { columns?: number }).columns = cols
	;(process.stdout as { rows?: number }).rows = rows
}

beforeEach(() => vi.spyOn(process.stdout, "write").mockImplementation(() => true))
afterEach(() => {
	;(process.stdout as { columns?: number }).columns = origCols
	;(process.stdout as { rows?: number }).rows = origRows
	vi.restoreAllMocks()
})

const videos = [
	{ id: "a1", title: "First Video", channel: "Alpha", duration: 0, durationFmt: "1:00", views: 1000 },
	{ id: "b2", title: "Second Video", channel: "Beta", duration: 0, durationFmt: "2:00", views: 2000 },
]

function capture(fn: () => void): string {
	const writes: string[] = []
	vi.spyOn(process.stdout, "write").mockImplementation((c: unknown) => {
		writes.push(String(c))
		return true
	})
	fn()
	return stripAnsi(writes.join(""))
}

describe("two-pane list view", () => {
	it("shows a divider and the preview pane on a wide terminal", () => {
		setDims(120, 24)
		const lv = createListView({ items: videos, formatItem: formatVideoItem, detail: true })
		const out = capture(() => lv.render())
		expect(out).toContain("First Video") // list item (left)
		expect(out).toContain("│") // vertical divider
		expect(out).toContain("Alpha") // detail pane channel (right)
	})

	it("collapses to a full-width list on a narrow terminal", () => {
		setDims(60, 24)
		const lv = createListView({ items: videos, formatItem: formatVideoItem, detail: true })
		const out = capture(() => lv.render())
		expect(out).toContain("First Video")
		expect(out).not.toContain("│") // no divider when collapsed
	})
})
