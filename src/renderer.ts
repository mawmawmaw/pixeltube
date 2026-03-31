// ANSI half-block frame renderer with diff optimization and 256-color fallback

import { fgRgb, bgRgb } from "./tui/theme.js"
import { syncOutput } from "./tui/theme.js"

const HALF_BLOCK: string = "▄"
const ESC_SYNC_START: string = syncOutput ? "\x1b[?2026h" : ""
const ESC_SYNC_END: string = syncOutput ? "\x1b[?2026l" : ""
const ESC_RESET: string = "\x1b[0m"

let prevFrame: Buffer | null = null

export function renderFrame(
	frameBuffer: Buffer,
	width: number,
	height: number,
	offsetRow: number = 1,
	offsetCol: number = 1,
	skipRow: number = -1,
): string {
	const halfRows: number = height >> 1
	const parts: string[] = [ESC_SYNC_START]

	let prevBgR: number = -1,
		prevBgG: number = -1,
		prevBgB: number = -1
	let prevFgR: number = -1,
		prevFgG: number = -1,
		prevFgB: number = -1
	let needsMove: boolean = true

	for (let row = 0; row < halfRows; row++) {
		if (row === skipRow) {
			needsMove = true
			continue
		}

		const y: number = row << 1
		needsMove = true

		for (let x = 0; x < width; x++) {
			const topIdx: number = (y * width + x) * 3
			const botIdx: number = topIdx + width * 3

			const bgR: number = frameBuffer[topIdx]
			const bgG: number = frameBuffer[topIdx + 1]
			const bgB: number = frameBuffer[topIdx + 2]
			const fgR: number = frameBuffer[botIdx]
			const fgG: number = frameBuffer[botIdx + 1]
			const fgB: number = frameBuffer[botIdx + 2]

			if (
				prevFrame &&
				prevFrame[topIdx] === bgR &&
				prevFrame[topIdx + 1] === bgG &&
				prevFrame[topIdx + 2] === bgB &&
				prevFrame[botIdx] === fgR &&
				prevFrame[botIdx + 1] === fgG &&
				prevFrame[botIdx + 2] === fgB
			) {
				needsMove = true
				continue
			}

			if (needsMove) {
				parts.push(`\x1b[${row + offsetRow};${x + offsetCol}H`)
				prevBgR = prevBgG = prevBgB = -1
				prevFgR = prevFgG = prevFgB = -1
				needsMove = false
			}

			if (bgR !== prevBgR || bgG !== prevBgG || bgB !== prevBgB) {
				parts.push(bgRgb(bgR, bgG, bgB))
				prevBgR = bgR
				prevBgG = bgG
				prevBgB = bgB
			}

			if (fgR !== prevFgR || fgG !== prevFgG || fgB !== prevFgB) {
				parts.push(fgRgb(fgR, fgG, fgB))
				prevFgR = fgR
				prevFgG = fgG
				prevFgB = fgB
			}

			parts.push(HALF_BLOCK)
		}
	}

	parts.push(ESC_RESET)
	parts.push(ESC_SYNC_END)

	if (!prevFrame) {
		prevFrame = Buffer.allocUnsafe(frameBuffer.length)
	}
	frameBuffer.copy(prevFrame)

	return parts.join("")
}

export function resetRenderer(): void {
	prevFrame = null
}
