// Scrollable list widget — thin adapter over the pure List component
// (src/tui/components/list.ts). Owns the content-region buffer and the
// load-more spinner timer; the component holds navigation/selection state.
// When `detail` is enabled it renders a two-pane layout: list on the left, a
// thumbnail/metadata preview on the right (responsive: collapses on narrow
// terminals).

import type { ListView } from "../types.js"
import { contentScreen } from "./screen.js"
import { createList } from "./components/list.js"
import { createDetailPane, type DetailItem } from "./components/detail.js"
import { theme } from "./theme.js"

// Below this content width the preview pane is hidden and the list goes full-width.
const MIN_TWO_PANE_WIDTH = 76
const LIST_FRACTION = 0.5

export function createListView({
	items = [],
	formatItem,
	onSelect,
	onBack,
	spacing = 0,
	onLoadMore,
	hasMore = false,
	detail = false,
}: {
	items?: unknown[]
	formatItem?: (item: any, width: number) => string
	onSelect?: (item: any, index: number) => void
	onBack?: () => void
	spacing?: number
	onLoadMore?: () => void
	hasMore?: boolean
	detail?: boolean
}): ListView {
	let spinnerTimer: ReturnType<typeof setInterval> | null = null

	const detailPane = detail ? createDetailPane({ onRepaint: () => render() }) : null

	function listWidth(fullW: number): number {
		return detailPane && fullW >= MIN_TWO_PANE_WIDTH ? Math.floor(fullW * LIST_FRACTION) : fullW
	}

	function render(): void {
		const buf = contentScreen()
		const fullW = buf.width
		const h = buf.height
		const lw = listWidth(fullW)

		list.render(buf, { x: 0, y: 0, w: lw, h }, true)

		if (detailPane && lw < fullW) {
			const divX = lw + 1
			for (let y = 0; y < h; y++) buf.put(divX, y, "│", theme.dim)
			const detailRect = { x: divX + 1, y: 0, w: fullW - divX - 1, h }
			detailPane.render((list.getSelected() as DetailItem) ?? null, buf, detailRect, false)
		}
		buf.flush()
	}

	function stopSpinnerTimer(): void {
		if (spinnerTimer) {
			clearInterval(spinnerTimer)
			spinnerTimer = null
		}
	}

	function startSpinnerTimer(): void {
		if (spinnerTimer) return
		spinnerTimer = setInterval(() => {
			list.advanceSpinner()
			render()
		}, 80)
	}

	const list = createList({
		items,
		formatItem,
		onSelect,
		onBack,
		spacing,
		hasMore,
		onRepaint: render,
		getViewHeight: () => contentScreen().height,
		onLoadMore: onLoadMore
			? () => {
					startSpinnerTimer()
					onLoadMore()
				}
			: undefined,
	})

	return {
		render,
		handleKey(key: string): void {
			list.handleKey(key)
		},
		setItems(newItems: unknown[]): void {
			list.setItems(newItems)
		},
		getItems<T>(): T[] {
			return list.getItems() as T[]
		},
		getSelected<T>(): T {
			return list.getSelected() as T
		},
		appendItems(newItems: unknown[]): void {
			stopSpinnerTimer()
			list.appendItems(newItems)
			render()
		},
		setHasMore(val: boolean): void {
			list.setHasMore(val)
			if (!val) stopSpinnerTimer()
		},
		capturesText(): boolean {
			return list.capturesText()
		},
	}
}
