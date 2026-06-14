// Menu component — a vertical list of label/description rows with selection
// highlight. Pure: paints into a provided buffer region, no I/O. Used by the
// main menu; navigation/selection state lives here.

import type { Screen } from "../buffer.js"
import type { Rect } from "../layout.js"
import { theme } from "../theme.js"

export interface MenuItem {
	label: string
	desc: string
	action?: string
}

export interface MenuOptions {
	items: MenuItem[]
	onSelect?: (item: MenuItem, index: number) => void
	onBack?: () => void
	onRepaint?: () => void
	spacing?: number
	maxWidth?: number
}

export interface Menu {
	render(buf: Screen, rect: Rect, focused?: boolean): void
	handleKey(key: string): boolean
	setItems(items: MenuItem[]): void
	getSelectedIndex(): number
}

export function createMenu(opts: MenuOptions): Menu {
	let items = opts.items
	let selectedIndex = 0
	const spacing = opts.spacing ?? 0
	const maxWidth = opts.maxWidth ?? 50

	function clampSelection(): void {
		if (selectedIndex >= items.length) selectedIndex = Math.max(0, items.length - 1)
	}

	function render(buf: Screen, rect: Rect, focused = true): void {
		clampSelection()
		const menuWidth = Math.min(maxWidth, rect.w - 4)
		const indent = rect.x + Math.floor((rect.w - menuWidth) / 2)

		for (let i = 0; i < items.length; i++) {
			const item = items[i]
			const y = rect.y + i * (1 + spacing)
			if (y >= rect.y + rect.h) break

			const isSel = i === selectedIndex && focused
			const arrow = isSel ? `${theme.selArrow}>` : " "
			const line = `  ${arrow}${theme.reset}  ${theme.bold}${item.label}${theme.reset}  ${theme.dim}${item.desc}${theme.reset}`

			if (isSel) {
				buf.fill({ x: indent, y, w: menuWidth, h: 1 }, " ", theme.selBg)
				buf.put(indent, y, line, theme.selBg)
			} else {
				buf.put(indent, y, line)
			}
		}
	}

	function handleKey(key: string): boolean {
		switch (key) {
			case "up":
				if (selectedIndex > 0) selectedIndex--
				opts.onRepaint?.()
				return true
			case "down":
				if (selectedIndex < items.length - 1) selectedIndex++
				opts.onRepaint?.()
				return true
			case "enter":
			case "right":
				if (items[selectedIndex] && opts.onSelect) opts.onSelect(items[selectedIndex], selectedIndex)
				return true
			case "escape":
			case "left":
				if (opts.onBack) {
					opts.onBack()
					return true
				}
				return false
			default:
				return false
		}
	}

	return {
		render,
		handleKey,
		setItems(newItems: MenuItem[]): void {
			items = newItems
			clampSelection()
		},
		getSelectedIndex: () => selectedIndex,
	}
}
