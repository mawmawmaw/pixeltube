// Shared list item formatters for video and playlist display.

import { theme } from "../tui/theme.js"
import { displayWidth, truncate } from "../tui/width.js"
import type { Video, Playlist, SearchResult } from "../types.js"

const DIM: string = theme.dim
const RESET: string = theme.reset

// Compact magnitude: 1.2M, 34K, 1.1B. Empty for non-positive/invalid input.
export function compactCount(n: number | undefined): string {
	if (!n || n <= 0) return ""
	if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, "")}B`
	if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`
	if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`
	return `${n}`
}

// Compact view count: 1.2M views, 34K views, 1.1B views.
export function formatViews(n: number | undefined): string {
	const c = compactCount(n)
	return c ? `${c} views` : ""
}

export function formatLikes(n: number | undefined): string {
	const c = compactCount(n)
	return c ? `${c} likes` : ""
}

export function formatSubscribers(n: number | undefined): string {
	const c = compactCount(n)
	return c ? `${c} subscribers` : ""
}

// Human "time ago" from a unix timestamp (seconds), falling back to a YYYYMMDD
// upload date. Returns "" when neither is usable.
export function formatUploadDate(timestamp?: number, uploadDate?: string): string {
	let ms: number | null = null
	if (timestamp && Number.isFinite(timestamp) && timestamp > 0) {
		ms = timestamp * 1000
	} else if (uploadDate && /^\d{8}$/.test(uploadDate)) {
		const y = Number(uploadDate.slice(0, 4))
		const mo = Number(uploadDate.slice(4, 6))
		const da = Number(uploadDate.slice(6, 8))
		ms = Date.UTC(y, mo - 1, da)
	}
	if (ms == null) return ""

	const diff = Date.now() - ms
	if (diff < 0) return ""
	const day = 86400000
	const units: [number, string][] = [
		[365 * day, "year"],
		[30 * day, "month"],
		[7 * day, "week"],
		[day, "day"],
		[3600000, "hour"],
		[60000, "minute"],
	]
	for (const [size, label] of units) {
		const v = Math.floor(diff / size)
		if (v >= 1) return `${v} ${label}${v === 1 ? "" : "s"} ago`
	}
	return "just now"
}

// A title on the left with a dim right-aligned metadata cluster.
function row(title: string, meta: string, width: number): string {
	const metaLen = displayWidth(meta)
	const maxTitle = Math.max(8, width - metaLen - 2)
	const t = truncate(title, maxTitle)
	const gap = Math.max(1, width - displayWidth(t) - metaLen)
	const metaDisplay = meta ? `${DIM}${meta}${RESET}` : ""
	return `${t}${" ".repeat(gap)}${metaDisplay}`
}

function videoMeta(v: { durationFmt?: string; views?: number }): string {
	const parts = [formatViews(v.views), v.durationFmt || ""].filter(Boolean)
	return parts.join(" · ")
}

export function formatVideoItem(v: Video, width: number): string {
	return row(v.title || v.id, videoMeta(v), width)
}

export function formatSearchResult(item: SearchResult, width: number): string {
	if (item.resultType === "video") {
		return row(item.title || item.id, videoMeta(item), width)
	}
	const tag = item.resultType === "playlist" ? "[playlist]" : "[channel]"
	return row(item.title, tag, width)
}

export function formatPlaylistItem(p: Playlist, width: number): string {
	const meta = p.videoCount != null ? `${p.videoCount} videos` : ""
	return row(p.title || "Untitled", meta, width)
}
