// Scrollable list widget with selection highlighting and keyboard navigation

import type { ListView } from "../types.js"
import { moveTo, cols, syncStart, syncEnd } from "./terminal.js"
import { contentRows } from "./screen.js"
import { theme } from "./theme.js"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

function visLen(str: string): number {
	return str.replace(/\x1b\[[0-9;]*m/g, "").length
}

export function createListView({
	items = [],
	formatItem,
	onSelect,
	onBack,
	spacing = 0,
	onLoadMore,
	hasMore: initialHasMore = false,
}: {
	items?: any[]
	formatItem?: (item: any, width: number) => string
	onSelect?: (item: any, index: number) => void
	onBack?: () => void
	spacing?: number
	onLoadMore?: () => void
	hasMore?: boolean
}): ListView {
	let selectedIndex: number = 0
	let scrollOffset: number = 0
	let currentItems: any[] = items
	let hasMore: boolean = initialHasMore
	let loadingMore: boolean = false
	let spinnerFrame: number = 0
	let spinnerInterval: ReturnType<typeof setInterval> | null = null

	function lineHeight(): number {
		const r = contentRows()
		return 1 + (r < 20 ? 0 : spacing)
	}

	function visibleItems(): number {
		return Math.floor(contentRows() / lineHeight())
	}

	function clampScroll(): void {
		const vis = visibleItems()
		if (selectedIndex < scrollOffset) scrollOffset = selectedIndex
		const reserve = loadingMore && selectedIndex >= currentItems.length - 1 ? 1 : 0
		if (selectedIndex + reserve >= scrollOffset + vis) scrollOffset = selectedIndex + reserve - vis + 1
		if (scrollOffset < 0) scrollOffset = 0
	}

	function startSpinnerTimer(): void {
		if (spinnerInterval) return
		spinnerInterval = setInterval(() => {
			spinnerFrame++
			renderSpinnerRow()
		}, 80)
	}

	function stopSpinnerTimer(): void {
		if (spinnerInterval) {
			clearInterval(spinnerInterval)
			spinnerInterval = null
		}
	}

	function renderSpinnerRow(): void {
		if (!loadingMore) return
		const w = cols()
		const vis = visibleItems()
		const lastVisIdx = scrollOffset + vis - 1
		if (lastVisIdx < currentItems.length) return
		const slotPos = currentItems.length - scrollOffset
		if (slotPos < 0 || slotPos >= vis) return
		const lh = lineHeight()
		const row = 2 + slotPos * lh
		const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]
		const msg = `   ${theme.dim}${theme.accentBold}${frame}${theme.reset}${theme.dim} Loading more...${theme.reset}`
		moveTo(row, 1)
		process.stdout.write(msg + " ".repeat(Math.max(0, w - 20)))
	}

	function checkLoadMore(): void {
		if (hasMore && !loadingMore && onLoadMore && selectedIndex >= currentItems.length - 10) {
			loadingMore = true
			startSpinnerTimer()
			onLoadMore()
		}
	}

	function render(): void {
		const w = cols()
		const vis = visibleItems()
		clampScroll()

		syncStart()

		for (let i = 0; i < vis; i++) {
			const idx = scrollOffset + i
			const lh = lineHeight()
			const baseRow = 2 + i * lh

			moveTo(baseRow, 1)
			if (idx < currentItems.length) {
				const item = currentItems[idx]
				const text = formatItem ? formatItem(item, w - 4) : String(item.label || item)
				const isSel = idx === selectedIndex
				const vl = visLen(text) + 3
				const pad = Math.max(0, w - vl)

				if (isSel) {
					const line = ` ${theme.selArrow}> ${text}${theme.reset}` + " ".repeat(pad)
					process.stdout.write(theme.selBg + theme.selArrow + line + theme.reset)
				} else {
					const line = "   " + text + " ".repeat(pad)
					process.stdout.write(line)
				}
			} else if (loadingMore && idx === currentItems.length) {
				const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]
				const msg = `   ${theme.dim}${theme.accentBold}${frame}${theme.reset}${theme.dim} Loading more...${theme.reset}`
				process.stdout.write(msg + " ".repeat(Math.max(0, w - 20)))
			} else {
				process.stdout.write(" ".repeat(w))
			}

			const lh2 = lineHeight()
			for (let s = 1; s < lh2; s++) {
				moveTo(baseRow + s, 1)
				process.stdout.write(" ".repeat(w))
			}
		}

		if (currentItems.length > vis) {
			const label = loadingMore
				? `${theme.dim} Loading more...${theme.reset}`
				: `${theme.dim} ${scrollOffset + 1}-${Math.min(scrollOffset + vis, currentItems.length)} of ${currentItems.length}${hasMore ? "+" : ""}${theme.reset}`
			const labelLen = visLen(label)
			moveTo(2, Math.max(1, w - labelLen))
			process.stdout.write(label)
		}

		syncEnd()
	}

	function handleKey(key: string): void {
		if (key === "up") {
			if (selectedIndex > 0) selectedIndex--
			render()
		} else if (key === "down") {
			if (selectedIndex < currentItems.length - 1) selectedIndex++
			checkLoadMore()
			render()
		} else if (key === "pageup") {
			selectedIndex = Math.max(0, selectedIndex - visibleItems())
			render()
		} else if (key === "pagedown") {
			selectedIndex = Math.min(currentItems.length - 1, selectedIndex + visibleItems())
			checkLoadMore()
			render()
		} else if (key === "home") {
			selectedIndex = 0
			render()
		} else if (key === "end") {
			selectedIndex = currentItems.length - 1
			checkLoadMore()
			render()
		} else if (key === "enter" || key === "right") {
			if (currentItems.length > 0 && onSelect) {
				onSelect(currentItems[selectedIndex], selectedIndex)
			}
		} else if ((key === "escape" || key === "left") && onBack) {
			onBack()
		}
	}

	function setItems(newItems: any[]): void {
		currentItems = newItems
		selectedIndex = 0
		scrollOffset = 0
	}

	function appendItems(newItems: any[]): void {
		currentItems = currentItems.concat(newItems)
		loadingMore = false
		stopSpinnerTimer()
		render()
	}

	function setHasMore(val: boolean): void {
		hasMore = val
		if (!val) loadingMore = false
	}

	return {
		render,
		handleKey,
		setItems,
		getItems: () => currentItems,
		getSelected: () => currentItems[selectedIndex],
		appendItems,
		setHasMore,
	}
}
