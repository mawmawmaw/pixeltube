// Shared list item formatters for video and playlist display

import { theme } from "../tui/theme.js"

const DIM = theme.dim
const RESET = theme.reset

export function formatVideoItem(v, width) {
	const title = v.title || v.id
	const dur = v.durationFmt || ""
	const durDisplay = dur ? `${DIM}${dur}${RESET}` : ""
	const durVisLen = dur.length
	const maxTitle = Math.max(10, width - durVisLen - 2)
	const truncTitle = title.length > maxTitle ? title.slice(0, maxTitle - 3) + "..." : title
	const gap = Math.max(1, width - truncTitle.length - durVisLen)
	return `${truncTitle}${" ".repeat(gap)}${durDisplay}`
}

export function formatPlaylistItem(p, width) {
	const title = p.title || "Untitled"
	if (p.videoCount != null) {
		const count = `${DIM}${p.videoCount} videos${RESET}`
		const countLen = `${p.videoCount} videos`.length
		const gap = Math.max(1, width - title.length - countLen)
		return `${title}${" ".repeat(gap)}${count}`
	}
	return title
}
