import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("../src/tui/terminal.js", () => ({
	moveTo: vi.fn(),
	cols: () => 80,
	syncStart: vi.fn(),
	syncEnd: vi.fn(),
}))

vi.mock("../src/tui/screen.js", () => ({
	contentRows: () => 20,
}))

vi.mock("../src/tui/theme.js", () => ({
	theme: {
		dim: "",
		bold: "",
		reset: "",
		selArrow: "",
		selBg: "",
		accentBold: "",
		progressFill: "",
		progressEmpty: "",
	},
}))

import { createListView } from "../src/tui/list-view.js"

function makeItems(n: number) {
	return Array.from({ length: n }, (_, i) => ({ label: `item-${i}` }))
}

describe("createListView", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.spyOn(process.stdout, "write").mockImplementation(() => true)
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	describe("lazy loading", () => {
		it("triggers onLoadMore when navigating near the end with down arrow", () => {
			const onLoadMore = vi.fn()
			const lv = createListView({
				items: makeItems(15),
				hasMore: true,
				onLoadMore,
			})

			// selectedIndex starts at 0, threshold is length - 10 = 5
			for (let i = 0; i < 5; i++) lv.handleKey("down")
			expect(onLoadMore).toHaveBeenCalledTimes(1)
		})

		it("triggers onLoadMore on pagedown near end", () => {
			const onLoadMore = vi.fn()
			const lv = createListView({
				items: makeItems(25),
				hasMore: true,
				onLoadMore,
			})

			// pagedown moves by visibleItems() = floor(20/1) = 20
			// selectedIndex becomes min(24, 0+20) = 20, threshold = 25-10 = 15
			lv.handleKey("pagedown")
			expect(onLoadMore).toHaveBeenCalledTimes(1)
		})

		it("triggers onLoadMore on end key", () => {
			const onLoadMore = vi.fn()
			const lv = createListView({
				items: makeItems(20),
				hasMore: true,
				onLoadMore,
			})

			lv.handleKey("end")
			expect(onLoadMore).toHaveBeenCalledTimes(1)
		})

		it("does not trigger onLoadMore when hasMore is false", () => {
			const onLoadMore = vi.fn()
			const lv = createListView({
				items: makeItems(15),
				hasMore: false,
				onLoadMore,
			})

			for (let i = 0; i < 14; i++) lv.handleKey("down")
			expect(onLoadMore).not.toHaveBeenCalled()
		})

		it("does not trigger onLoadMore twice while already loading", () => {
			const onLoadMore = vi.fn()
			const lv = createListView({
				items: makeItems(15),
				hasMore: true,
				onLoadMore,
			})

			// Navigate past threshold
			for (let i = 0; i < 6; i++) lv.handleKey("down")
			expect(onLoadMore).toHaveBeenCalledTimes(1)

			// Keep navigating — should not fire again
			lv.handleKey("down")
			lv.handleKey("down")
			expect(onLoadMore).toHaveBeenCalledTimes(1)
		})

		it("appendItems adds items and allows new onLoadMore", () => {
			const onLoadMore = vi.fn()
			const lv = createListView({
				items: makeItems(15),
				hasMore: true,
				onLoadMore,
			})

			// Trigger first load
			lv.handleKey("end")
			expect(onLoadMore).toHaveBeenCalledTimes(1)

			// Simulate async response
			const moreItems = makeItems(10)
			lv.appendItems(moreItems)
			expect(lv.getItems()).toHaveLength(25)

			// Navigate to new end — should trigger again
			lv.handleKey("end")
			expect(onLoadMore).toHaveBeenCalledTimes(2)
		})

		it("setHasMore(false) prevents further loading", () => {
			const onLoadMore = vi.fn()
			const lv = createListView({
				items: makeItems(15),
				hasMore: true,
				onLoadMore,
			})

			lv.setHasMore(false)
			lv.handleKey("end")
			expect(onLoadMore).not.toHaveBeenCalled()
		})

		it("appendItems preserves current selection", () => {
			const lv = createListView({
				items: makeItems(15),
				hasMore: true,
				onLoadMore: vi.fn(),
			})

			// Navigate to item 5
			for (let i = 0; i < 5; i++) lv.handleKey("down")
			const selected = lv.getSelected()
			expect(selected.label).toBe("item-5")

			lv.appendItems(makeItems(10))

			// Selection should still be on item 5
			expect(lv.getSelected().label).toBe("item-5")
		})

		it("cleans up spinner interval on appendItems", () => {
			const clearIntervalSpy = vi.spyOn(global, "clearInterval")
			const lv = createListView({
				items: makeItems(15),
				hasMore: true,
				onLoadMore: vi.fn(),
			})

			lv.handleKey("end") // triggers loadMore → starts spinner
			const callsBefore = clearIntervalSpy.calls?.length ?? 0

			lv.appendItems(makeItems(5)) // should stop spinner
			expect(clearIntervalSpy).toHaveBeenCalled()
		})
	})

	describe("page navigation", () => {
		it("pagedown moves selection by visible items count", () => {
			const lv = createListView({ items: makeItems(50) })

			lv.handleKey("pagedown")
			// visibleItems = floor(20/1) = 20
			expect(lv.getSelected().label).toBe("item-20")
		})

		it("pageup moves selection up by visible items count", () => {
			const lv = createListView({ items: makeItems(50) })

			// Go to end first, then pageup
			lv.handleKey("end")
			expect(lv.getSelected().label).toBe("item-49")

			lv.handleKey("pageup")
			// 49 - 20 = 29
			expect(lv.getSelected().label).toBe("item-29")
		})

		it("home moves selection to first item", () => {
			const lv = createListView({ items: makeItems(50) })

			lv.handleKey("end")
			lv.handleKey("home")
			expect(lv.getSelected().label).toBe("item-0")
		})

		it("end moves selection to last item", () => {
			const lv = createListView({ items: makeItems(50) })

			lv.handleKey("end")
			expect(lv.getSelected().label).toBe("item-49")
		})

		it("pagedown clamps to last item", () => {
			const lv = createListView({ items: makeItems(10) })

			lv.handleKey("pagedown")
			expect(lv.getSelected().label).toBe("item-9")
		})

		it("pageup clamps to first item", () => {
			const lv = createListView({ items: makeItems(10) })

			lv.handleKey("down")
			lv.handleKey("down")
			lv.handleKey("pageup")
			expect(lv.getSelected().label).toBe("item-0")
		})
	})

	describe("callbacks", () => {
		it("onSelect fires with correct item and index", () => {
			const onSelect = vi.fn()
			const items = makeItems(5)
			const lv = createListView({ items, onSelect })

			lv.handleKey("down")
			lv.handleKey("down")
			lv.handleKey("enter")
			expect(onSelect).toHaveBeenCalledWith(items[2], 2)
		})

		it("onBack fires on escape", () => {
			const onBack = vi.fn()
			const lv = createListView({ items: makeItems(5), onBack })

			lv.handleKey("escape")
			expect(onBack).toHaveBeenCalledTimes(1)
		})

		it("onBack fires on left arrow", () => {
			const onBack = vi.fn()
			const lv = createListView({ items: makeItems(5), onBack })

			lv.handleKey("left")
			expect(onBack).toHaveBeenCalledTimes(1)
		})
	})
})
