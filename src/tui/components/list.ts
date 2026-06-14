// List component — scrollable, selectable, with lazy load-more and type-to-
// filter. Pure: it holds state and paints into a provided buffer region; it
// performs no I/O and owns no timers. The owning adapter (src/tui/list-view.ts)
// drives repaints and the load-more spinner.

import type { Screen } from "../buffer.js"
import type { Rect } from "../layout.js"
import { theme } from "../theme.js"
import { displayWidth, stripAnsi } from "../width.js"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export interface ListOptions {
	items?: unknown[]
	formatItem?: (item: unknown, width: number) => string
	onSelect?: (item: unknown, index: number) => void
	onBack?: () => void
	onLoadMore?: () => void
	onRepaint?: () => void
	getViewHeight?: () => number
	hasMore?: boolean
	spacing?: number
}

export interface List {
	render(buf: Screen, rect: Rect, focused?: boolean): void
	handleKey(key: string): boolean
	setItems(items: unknown[]): void
	getItems(): unknown[]
	getSelected(): unknown
	appendItems(items: unknown[]): void
	setHasMore(val: boolean): void
	advanceSpinner(): void
	isLoadingMore(): boolean
	stopLoading(): void
	capturesText(): boolean
}

export function createList(opts: ListOptions): List {
	let items = opts.items ?? []
	let selectedIndex = 0
	let scrollOffset = 0
	let hasMore = opts.hasMore ?? false
	let loadingMore = false
	let spinnerFrame = 0
	const spacing = opts.spacing ?? 0

	// Type-to-filter state. While filtering, navigation and selection operate on
	// the narrowed view, but load-more stays disabled and onSelect still reports
	// the item's index in the full underlying array.
	let filtering = false
	let filterQuery = ""

	let viewH = 1

	function vh(): number {
		return opts.getViewHeight ? opts.getViewHeight() : viewH
	}

	function lineHeight(): number {
		return 1 + (vh() < 20 ? 0 : spacing)
	}

	function visibleItems(): number {
		return Math.max(1, Math.floor(vh() / lineHeight()))
	}

	function matchText(item: unknown): string {
		const raw = opts.formatItem ? opts.formatItem(item, 256) : String((item as { label?: string }).label ?? item)
		return stripAnsi(raw).toLowerCase()
	}

	// The (possibly filtered) list that drives display and navigation.
	function view(): unknown[] {
		if (!filtering || !filterQuery) return items
		const q = filterQuery.toLowerCase()
		return items.filter((it) => matchText(it).includes(q))
	}

	function clampScroll(list: unknown[]): void {
		const vis = visibleItems()
		if (selectedIndex > list.length - 1) selectedIndex = Math.max(0, list.length - 1)
		if (selectedIndex < scrollOffset) scrollOffset = selectedIndex
		const reserve = loadingMore && selectedIndex >= list.length - 1 ? 1 : 0
		if (selectedIndex + reserve >= scrollOffset + vis) scrollOffset = selectedIndex + reserve - vis + 1
		if (scrollOffset < 0) scrollOffset = 0
	}

	function checkLoadMore(): void {
		if (filtering) return
		if (hasMore && !loadingMore && opts.onLoadMore && selectedIndex >= items.length - 10) {
			loadingMore = true
			opts.onLoadMore()
		}
	}

	function repaint(): void {
		opts.onRepaint?.()
	}

	function render(buf: Screen, rect: Rect, focused = true): void {
		viewH = rect.h
		const w = rect.w
		const vis = visibleItems()
		const lh = lineHeight()
		const list = view()
		clampScroll(list)

		buf.fill(rect, " ", "")

		for (let i = 0; i < vis; i++) {
			const idx = scrollOffset + i
			const y = rect.y + i * lh
			if (y >= rect.y + rect.h) break

			if (idx < list.length) {
				const item = list[idx] as { label?: string }
				const text = opts.formatItem ? opts.formatItem(item, w - 4) : String(item.label ?? item)
				const isSel = idx === selectedIndex && focused
				if (isSel) {
					buf.fill({ x: rect.x, y, w, h: 1 }, " ", theme.selBg)
					buf.put(rect.x, y, ` ${theme.selArrow}>${theme.reset} ${text}`, theme.selBg)
				} else {
					buf.put(rect.x, y, `   ${text}`)
				}
			} else if (loadingMore && idx === list.length) {
				const frame = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]
				buf.put(
					rect.x,
					y,
					`   ${theme.dim}${theme.accentBold}${frame}${theme.reset}${theme.dim} Loading more...${theme.reset}`,
				)
			}
		}

		// Right-aligned status: filter query while filtering, else pagination.
		let label: string | null = null
		if (filtering) {
			label = `${theme.accentBold}/${filterQuery}${theme.reset}${theme.dim} ${list.length}/${items.length}${theme.reset}`
		} else if (items.length > vis) {
			label = loadingMore
				? `${theme.dim} Loading more...${theme.reset}`
				: `${theme.dim} ${scrollOffset + 1}-${Math.min(scrollOffset + vis, items.length)} of ${items.length}${hasMore ? "+" : ""}${theme.reset}`
		}
		if (label) {
			const lx = rect.x + Math.max(0, w - displayWidth(label))
			buf.put(lx, rect.y, label)
		}
	}

	function selectCurrent(): void {
		const list = view()
		const item = list[selectedIndex]
		if (item !== undefined && opts.onSelect) opts.onSelect(item, items.indexOf(item))
	}

	function handleFilterKey(key: string): boolean {
		switch (key) {
			case "escape":
				filtering = false
				filterQuery = ""
				selectedIndex = 0
				scrollOffset = 0
				repaint()
				return true
			case "backspace":
				filterQuery = filterQuery.slice(0, -1)
				selectedIndex = 0
				scrollOffset = 0
				repaint()
				return true
			case "enter":
			case "right":
				selectCurrent()
				return true
			case "up":
				if (selectedIndex > 0) selectedIndex--
				repaint()
				return true
			case "down":
				if (selectedIndex < view().length - 1) selectedIndex++
				repaint()
				return true
			case "pageup":
				selectedIndex = Math.max(0, selectedIndex - visibleItems())
				repaint()
				return true
			case "pagedown":
				selectedIndex = Math.min(view().length - 1, selectedIndex + visibleItems())
				repaint()
				return true
			case "home":
				selectedIndex = 0
				repaint()
				return true
			case "end":
				selectedIndex = Math.max(0, view().length - 1)
				repaint()
				return true
			case "left":
				return true // consume to avoid leaving the screen mid-filter
			default:
				if (key.length === 1) {
					filterQuery += key
					selectedIndex = 0
					scrollOffset = 0
					repaint()
					return true
				}
				return true
		}
	}

	function handleKey(key: string): boolean {
		if (filtering) return handleFilterKey(key)

		switch (key) {
			case "/":
				filtering = true
				filterQuery = ""
				selectedIndex = 0
				scrollOffset = 0
				repaint()
				return true
			case "up":
				if (selectedIndex > 0) selectedIndex--
				repaint()
				return true
			case "down":
				if (selectedIndex < items.length - 1) selectedIndex++
				checkLoadMore()
				repaint()
				return true
			case "pageup":
				selectedIndex = Math.max(0, selectedIndex - visibleItems())
				repaint()
				return true
			case "pagedown":
				selectedIndex = Math.min(items.length - 1, selectedIndex + visibleItems())
				checkLoadMore()
				repaint()
				return true
			case "home":
				selectedIndex = 0
				repaint()
				return true
			case "end":
				selectedIndex = items.length - 1
				checkLoadMore()
				repaint()
				return true
			case "enter":
			case "right":
				selectCurrent()
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
		setItems(newItems: unknown[]): void {
			items = newItems
			selectedIndex = 0
			scrollOffset = 0
			filtering = false
			filterQuery = ""
		},
		getItems: () => items,
		getSelected: () => view()[selectedIndex],
		appendItems(newItems: unknown[]): void {
			items = items.concat(newItems)
			loadingMore = false
		},
		setHasMore(val: boolean): void {
			hasMore = val
			if (!val) loadingMore = false
		},
		advanceSpinner(): void {
			spinnerFrame++
		},
		isLoadingMore: () => loadingMore,
		stopLoading(): void {
			loadingMore = false
		},
		capturesText: () => filtering,
	}
}
