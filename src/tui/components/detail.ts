// Detail pane — renders a pixel-art thumbnail (half-blocks) plus wrapped title
// and metadata for the selected list item. Thumbnails load asynchronously and
// repaint when ready; everything degrades to a placeholder on failure.

import type { Screen } from "../buffer.js"
import type { Rect } from "../layout.js"
import { theme, fgRgb, bgRgb } from "../theme.js"
import { wrap, truncate } from "../width.js"
import { drawBox } from "./box.js"
import { loadThumbnail, getCachedThumbnail, thumbnailFailed } from "../../browse/thumbnail.js"
import { loadVideoDetail, getCachedVideoDetail, videoDetailFailed } from "../../browse/video-detail.js"
import { formatViews, formatLikes, formatSubscribers, formatUploadDate } from "../../browse/format.js"

const HALF = "▄"

export interface DetailItem {
	id: string
	title: string
	channel?: string
	durationFmt?: string
	views?: number
}

export interface DetailPane {
	render(item: DetailItem | null, buf: Screen, rect: Rect, focused?: boolean): void
}

export function createDetailPane(opts: { onRepaint?: () => void } = {}): DetailPane {
	let loadTimer: ReturnType<typeof setTimeout> | null = null
	let pendingKey = ""
	let detailTimer: ReturnType<typeof setTimeout> | null = null
	let detailPendingId = ""

	function scheduleLoad(id: string, w: number, h: number): void {
		const k = `${id}:${w}x${h}`
		if (k === pendingKey) return
		pendingKey = k
		if (loadTimer) clearTimeout(loadTimer)
		loadTimer = setTimeout(() => {
			loadThumbnail(id, w, h).then((buf) => {
				// Only repaint if this is still the item we're waiting on.
				if (buf && pendingKey === k) opts.onRepaint?.()
			})
		}, 120)
	}

	// Lazily fetch extra metadata (upload date, likes, subscribers, description)
	// for the selected item. Debounced so scrolling fast doesn't fire a request
	// per row, and only repaints if the selection hasn't moved on.
	function scheduleDetailLoad(id: string): void {
		if (id === detailPendingId) return
		detailPendingId = id
		if (detailTimer) clearTimeout(detailTimer)
		detailTimer = setTimeout(() => {
			loadVideoDetail(id).then((d) => {
				if (d && detailPendingId === id) opts.onRepaint?.()
			})
		}, 250)
	}

	function drawThumb(buf: Screen, rect: Rect, rgb: Buffer, pxW: number, pxH: number): void {
		for (let cy = 0; cy < rect.h; cy++) {
			for (let cx = 0; cx < rect.w; cx++) {
				const top = (2 * cy * pxW + cx) * 3
				const bot = ((2 * cy + 1) * pxW + cx) * 3
				const style = bgRgb(rgb[top], rgb[top + 1], rgb[top + 2]) + fgRgb(rgb[bot], rgb[bot + 1], rgb[bot + 2])
				buf.put(rect.x + cx, rect.y + cy, HALF, style)
			}
		}
	}

	function drawPlaceholder(buf: Screen, rect: Rect, label: string): void {
		buf.fill(rect, " ", theme.selBg)
		const msg = truncate(label, rect.w)
		const tx = rect.x + Math.max(0, Math.floor((rect.w - msg.length) / 2))
		const ty = rect.y + Math.floor(rect.h / 2)
		buf.put(tx, ty, `${theme.dim}${msg}${theme.reset}`)
	}

	function render(item: DetailItem | null, buf: Screen, rect: Rect, _focused = true): void {
		buf.fill(rect, " ", "")
		drawBox(buf, rect, theme.dim)
		const inner: Rect = { x: rect.x + 2, y: rect.y + 1, w: rect.w - 4, h: rect.h - 2 }
		if (inner.w < 4 || inner.h < 2 || !item) return

		// Thumbnail area: 16:9, capped to half the pane height.
		let cursorY = inner.y
		const thumbCellH = Math.min(Math.max(0, Math.round((inner.w * 9) / 16 / 2)), Math.floor(inner.h / 2))
		if (item.id && thumbCellH >= 2) {
			const thumbRect: Rect = { x: inner.x, y: inner.y, w: inner.w, h: thumbCellH }
			const pxW = inner.w
			const pxH = thumbCellH * 2
			const rgb = getCachedThumbnail(item.id, pxW, pxH)
			if (rgb) {
				drawThumb(buf, thumbRect, rgb, pxW, pxH)
			} else if (thumbnailFailed(item.id, pxW, pxH)) {
				drawPlaceholder(buf, thumbRect, "no preview")
			} else {
				drawPlaceholder(buf, thumbRect, "loading preview…")
				scheduleLoad(item.id, pxW, pxH)
			}
			cursorY = thumbRect.y + thumbCellH + 1
		}

		// Extra metadata is fetched lazily per selected item; until it arrives we
		// just render what the list row already carries.
		const detail = item.id ? getCachedVideoDetail(item.id) : null
		if (item.id && !detail) scheduleDetailLoad(item.id)
		const loadingInfo = !!item.id && !detail && !videoDetailFailed(item.id)

		const bottom = inner.y + inner.h
		const line = (text: string, style: string): void => {
			if (cursorY >= bottom || !text) return
			buf.put(inner.x, cursorY, `${style}${truncate(text, inner.w)}${theme.reset}`)
			cursorY++
		}

		// Title (wrapped, bold).
		const titleLines = wrap(item.title || "", inner.w, 3)
		for (const ln of titleLines) {
			if (cursorY >= bottom) break
			buf.put(inner.x, cursorY, `${theme.bold}${ln}${theme.reset}`)
			cursorY++
		}
		cursorY++

		// Channel (backfilled from the lazy fetch when the list row lacked it),
		// with subscriber count appended once known.
		const channel = item.channel || detail?.channel
		if (channel) {
			const subs = formatSubscribers(detail?.subscribers)
			const channelLine = subs
				? `${theme.accent}${channel}${theme.reset}  ${theme.dim}${subs}${theme.reset}`
				: `${theme.accent}${channel}${theme.reset}`
			line(channelLine, "")
		}

		// Stats: views · likes · upload date · duration.
		const views = item.views ?? detail?.views
		const statsParts = [
			formatViews(views),
			formatLikes(detail?.likes),
			formatUploadDate(detail?.timestamp, detail?.uploadDate),
			item.durationFmt || "",
		].filter(Boolean)
		line(statsParts.join(" · "), theme.dim)

		// While the extra metadata is still in flight, show a hint where it'll land.
		if (loadingInfo && cursorY < bottom) {
			cursorY++
			line("loading info…", theme.dim)
		}

		// Description fills whatever vertical space remains.
		if (detail?.description && cursorY < bottom - 1) {
			cursorY++
			const descLines = wrap(detail.description.replace(/\s*\n\s*/g, " "), inner.w, bottom - cursorY)
			for (const ln of descLines) line(ln, theme.dim)
		}
	}

	return { render }
}
