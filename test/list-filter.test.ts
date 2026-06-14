import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createList } from "../src/tui/components/list.js"
import { Screen } from "../src/tui/buffer.js"
import { stripAnsi } from "../src/tui/width.js"

const fmt = (it: unknown) => (it as { label: string }).label
const sample = () => [{ label: "apple" }, { label: "banana" }, { label: "cherry" }, { label: "apricot" }]

beforeEach(() => {
	vi.spyOn(process.stdout, "write").mockImplementation(() => true)
})
afterEach(() => vi.restoreAllMocks())

describe("List type-to-filter", () => {
	it("enters filter mode on '/' and captures text", () => {
		const list = createList({ items: sample(), formatItem: fmt, getViewHeight: () => 20 })
		expect(list.capturesText()).toBe(false)
		list.handleKey("/")
		expect(list.capturesText()).toBe(true)
	})

	it("narrows the view as the query is typed", () => {
		const list = createList({ items: sample(), formatItem: fmt, getViewHeight: () => 20 })
		list.handleKey("/")
		list.handleKey("a")
		list.handleKey("p")
		// "ap" matches apple, apricot
		expect(list.getSelected()).toEqual({ label: "apple" })
		list.handleKey("down")
		expect(list.getSelected()).toEqual({ label: "apricot" })
	})

	it("reports onSelect index in the ORIGINAL array, not the filtered view", () => {
		let captured: { item: unknown; idx: number } | null = null
		const list = createList({
			items: sample(),
			formatItem: fmt,
			getViewHeight: () => 20,
			onSelect: (item, idx) => {
				captured = { item, idx }
			},
		})
		list.handleKey("/")
		list.handleKey("a")
		list.handleKey("p")
		list.handleKey("down") // apricot
		list.handleKey("enter")
		expect(captured!.item).toEqual({ label: "apricot" })
		expect(captured!.idx).toBe(3) // apricot's index in the full list
	})

	it("escape exits filter mode and restores the full list", () => {
		const list = createList({ items: sample(), formatItem: fmt, getViewHeight: () => 20 })
		list.handleKey("/")
		list.handleKey("z") // matches nothing
		expect(list.getSelected()).toBeUndefined()
		list.handleKey("escape")
		expect(list.capturesText()).toBe(false)
		expect(list.getSelected()).toEqual({ label: "apple" })
	})

	it("treats 'q' as a filter character while filtering (not quit)", () => {
		const list = createList({ items: sample(), formatItem: fmt, getViewHeight: () => 20 })
		list.handleKey("/")
		expect(list.handleKey("q")).toBe(true)
		expect(list.capturesText()).toBe(true)
		expect(list.getItems()).toHaveLength(4)
	})

	it("does not trigger load-more while filtering", () => {
		const onLoadMore = vi.fn()
		const list = createList({
			items: Array.from({ length: 30 }, (_, i) => ({ label: `v${i}` })),
			formatItem: fmt,
			hasMore: true,
			onLoadMore,
			getViewHeight: () => 20,
		})
		list.handleKey("/")
		list.handleKey("v")
		list.handleKey("end")
		expect(onLoadMore).not.toHaveBeenCalled()
	})

	it("renders the filter indicator", () => {
		const list = createList({ items: sample(), formatItem: fmt, getViewHeight: () => 20 })
		list.handleKey("/")
		list.handleKey("a")
		list.handleKey("p")
		const buf = new Screen(40, 20)
		list.render(buf, { x: 0, y: 0, w: 40, h: 20 }, true)
		const out = stripAnsi(buf.flush())
		expect(out).toContain("/ap")
		expect(out).toContain("2/4") // 2 matches of 4
	})

	it("clears the filter on setItems", () => {
		const list = createList({ items: sample(), formatItem: fmt, getViewHeight: () => 20 })
		list.handleKey("/")
		list.handleKey("a")
		list.setItems([{ label: "x" }, { label: "y" }])
		expect(list.capturesText()).toBe(false)
		expect(list.getItems()).toHaveLength(2)
	})
})
