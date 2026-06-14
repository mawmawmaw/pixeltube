// Screen primitives — title bar, status bar, spinners, content area.
// Title/status/spinner write directly (single rows, no flicker). The content
// region (rows 2..rows-1) is backed by a diff-buffered Screen that components
// render into; see src/tui/buffer.ts.

import { moveTo, cols, rows } from "./terminal.js"
import { theme } from "./theme.js"
import { displayWidth, truncate } from "./width.js"
import { Screen } from "./buffer.js"
import type { Spinner } from "../types.js"

const SPINNER_FRAMES: string[] = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

// Fit `text` to exactly `width` display columns: truncate if too long, pad with
// spaces if short. ANSI-aware so styled and wide-char text align correctly.
function fit(text: string, width: number): string {
	const clipped = truncate(text, width)
	const pad = Math.max(0, width - displayWidth(clipped))
	return clipped + " ".repeat(pad)
}

export function drawTitleBar(text: string): void {
	const w = cols()
	moveTo(1, 1)
	process.stdout.write(`\x1b[7m${theme.bold} ${fit(text, w - 1)}${theme.reset}`)
}

export function drawStatusBar(text: string): void {
	const w = cols()
	moveTo(rows(), 1)
	process.stdout.write(`${theme.dim} ${fit(text, w - 1)}${theme.reset}`)
}

export function drawLoading(message: string = "Loading..."): void {
	const w = cols()
	const midRow = Math.floor(rows() / 2)
	const clipped = truncate(message, w)
	const lead = Math.max(0, Math.floor((w - displayWidth(clipped)) / 2))
	moveTo(midRow, 1)
	process.stdout.write(`${theme.dim}${" ".repeat(lead)}${clipped}${theme.reset}`)
}

export function startSpinner(message: string = "Loading"): Spinner {
	const midRow = Math.floor(rows() / 2)
	let frame = 0
	let stopped = false

	function draw(): void {
		if (stopped) return
		const w = cols()
		const safeMsg = truncate(message, w - 6)
		const spinner = `${theme.accentBold}${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]}${theme.reset}`
		const text = ` ${spinner} ${safeMsg}`
		const lead = Math.max(0, Math.floor((w - displayWidth(safeMsg) - 4) / 2))
		moveTo(midRow, 1)
		process.stdout.write("\x1b[2K" + " ".repeat(lead) + text)
		frame++
	}

	draw()
	const interval = setInterval(draw, 80)

	return {
		stop(): void {
			stopped = true
			clearInterval(interval)
			moveTo(midRow, 1)
			process.stdout.write("\x1b[2K")
		},
		update(newMessage: string): void {
			message = newMessage
		},
	}
}

export function contentRows(): number {
	return rows() - 2
}

// --- Content-region buffer ------------------------------------------------
// A single diff-buffered Screen spanning the content area (terminal rows
// 2..rows-1). Components render into local 0-based coordinates; the buffer
// offsets them to the real region on flush.

let content: Screen | null = null

export function contentScreen(): Screen {
	const w = cols()
	const h = Math.max(1, contentRows())
	if (!content) {
		content = new Screen(w, h, 0, 1)
	} else if (content.width !== w || content.height !== h) {
		content.resize(w, h, 0, 1)
	}
	return content
}

// Drop the diff baseline so the next render fully repaints (e.g. after a
// direct-write loading screen or a terminal resize clobbered the region).
export function invalidateContent(): void {
	content?.invalidate()
}

export function clearContent(): void {
	const w = cols()
	const r = rows()
	const blank = " ".repeat(w)
	for (let i = 2; i < r; i++) {
		moveTo(i, 1)
		process.stdout.write(blank)
	}
	// The region was wiped by direct writes; reset the buffer's diff baseline.
	invalidateContent()
}
