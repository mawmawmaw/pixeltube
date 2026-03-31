// ANSI half-block frame renderer with diff optimization and 256-color fallback

import { fgRgb, bgRgb } from "./tui/theme.js"
import { syncOutput } from "./tui/theme.js"

const HALF_BLOCK = "▄"
const ESC_SYNC_START = syncOutput ? "\x1b[?2026h" : ""
const ESC_SYNC_END = syncOutput ? "\x1b[?2026l" : ""
const ESC_RESET = "\x1b[0m"

let prevFrame = null

export function renderFrame(frameBuffer, width, height, offsetRow = 1, offsetCol = 1, skipRow = -1) {
	const halfRows = height >> 1
	const parts = [ESC_SYNC_START]

	let prevBgR = -1,
		prevBgG = -1,
		prevBgB = -1
	let prevFgR = -1,
		prevFgG = -1,
		prevFgB = -1
	let needsMove = true

	for (let row = 0; row < halfRows; row++) {
		if (row === skipRow) {
			needsMove = true
			continue
		}

		const y = row << 1
		needsMove = true

		for (let x = 0; x < width; x++) {
			const topIdx = (y * width + x) * 3
			const botIdx = topIdx + width * 3

			const bgR = frameBuffer[topIdx]
			const bgG = frameBuffer[topIdx + 1]
			const bgB = frameBuffer[topIdx + 2]
			const fgR = frameBuffer[botIdx]
			const fgG = frameBuffer[botIdx + 1]
			const fgB = frameBuffer[botIdx + 2]

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

export function resetRenderer() {
	prevFrame = null
}
