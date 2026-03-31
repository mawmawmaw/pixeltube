// SRT subtitle parser and time-based lookup

import type { Subtitle } from "../types.js"

export function parseSrt(text: string): Subtitle[] {
	const subs: Subtitle[] = []
	const blocks = text.split(/\n\n+/)
	for (const block of blocks) {
		const lines = block.trim().split("\n")
		if (lines.length < 3) continue
		const timeMatch = lines[1].match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/)
		if (!timeMatch) continue
		const start = +timeMatch[1] * 3600 + +timeMatch[2] * 60 + +timeMatch[3] + +timeMatch[4] / 1000
		const end = +timeMatch[5] * 3600 + +timeMatch[6] * 60 + +timeMatch[7] + +timeMatch[8] / 1000
		const subText = lines
			.slice(2)
			.join(" ")
			.replace(/<[^>]+>/g, "")
			.trim()
		if (subText) subs.push({ start, end, text: subText })
	}
	return subs
}

export function findSub(subs: Subtitle[], time: number): string | null {
	for (const s of subs) {
		if (time >= s.start && time <= s.end) return s.text
	}
	return null
}
