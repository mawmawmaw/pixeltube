// Scrollable list widget with selection highlighting and keyboard navigation

import type { ListView } from "../types.js"
import { moveTo, cols, syncStart, syncEnd } from "./terminal.js"
import { contentRows } from "./screen.js"
import { theme } from "./theme.js"

function visLen(str: string): number {
	return str.replace(/\x1b\[[0-9;]*m/g, "").length
}

export function createListView({
	items = [],
	formatItem,
	onSelect,
	onBack,
	spacing = 0,
}: {
	items?: any[]
	formatItem?: (item: any, width: number) => string
	onSelect?: (item: any, index: number) => void
	onBack?: () => void
	spacing?: number
}): ListView {
	let selectedIndex: number = 0
	let scrollOffset: number = 0
	let currentItems: any[] = items

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
		if (selectedIndex >= scrollOffset + vis) scrollOffset = selectedIndex - vis + 1
		if (scrollOffset < 0) scrollOffset = 0
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
			const indicator = `${theme.dim} ${scrollOffset + 1}-${Math.min(scrollOffset + vis, currentItems.length)} of ${currentItems.length}${theme.reset}`
			moveTo(2, w - 20)
			process.stdout.write(indicator)
		}

		syncEnd()
	}

	function handleKey(key: string): void {
		if (key === "up") {
			if (selectedIndex > 0) selectedIndex--
			render()
		} else if (key === "down") {
			if (selectedIndex < currentItems.length - 1) selectedIndex++
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

	return { render, handleKey, setItems, getItems: () => currentItems, getSelected: () => currentItems[selectedIndex] }
}
