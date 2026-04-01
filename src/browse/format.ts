// Shared list item formatters for video and playlist display

import { theme } from "../tui/theme.js"
import type { Video, Playlist, SearchResult } from "../types.js"

const DIM: string = theme.dim
const RESET: string = theme.reset

export function formatVideoItem(v: Video, width: number): string {
	const title: string = v.title || v.id
	const dur: string = v.durationFmt || ""
	const durDisplay: string = dur ? `${DIM}${dur}${RESET}` : ""
	const durVisLen: number = dur.length
	const maxTitle: number = Math.max(10, width - durVisLen - 2)
	const truncTitle: string = title.length > maxTitle ? title.slice(0, maxTitle - 3) + "..." : title
	const gap: number = Math.max(1, width - truncTitle.length - durVisLen)
	return `${truncTitle}${" ".repeat(gap)}${durDisplay}`
}

export function formatSearchResult(item: SearchResult, width: number): string {
	if (item.resultType === "video") {
		const title: string = item.title || item.id
		const dur: string = item.durationFmt || ""
		const durDisplay: string = dur ? `${DIM}${dur}${RESET}` : ""
		const durVisLen: number = dur.length
		const maxTitle: number = Math.max(10, width - durVisLen - 2)
		const truncTitle: string = title.length > maxTitle ? title.slice(0, maxTitle - 3) + "..." : title
		const gap: number = Math.max(1, width - truncTitle.length - durVisLen)
		return `${truncTitle}${" ".repeat(gap)}${durDisplay}`
	}
	const tag: string = item.resultType === "playlist" ? "[playlist]" : "[channel]"
	const tagDisplay: string = `${DIM}${tag}${RESET}`
	const maxTitle: number = Math.max(10, width - tag.length - 2)
	const truncTitle: string = item.title.length > maxTitle ? item.title.slice(0, maxTitle - 3) + "..." : item.title
	const gap: number = Math.max(1, width - truncTitle.length - tag.length)
	return `${truncTitle}${" ".repeat(gap)}${tagDisplay}`
}

export function formatPlaylistItem(p: Playlist, width: number): string {
	const title: string = p.title || "Untitled"
	if (p.videoCount != null) {
		const count: string = `${DIM}${p.videoCount} videos${RESET}`
		const countLen: number = `${p.videoCount} videos`.length
		const gap: number = Math.max(1, width - title.length - countLen)
		return `${title}${" ".repeat(gap)}${count}`
	}
	return title
}
