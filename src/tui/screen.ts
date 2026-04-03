// Screen primitives — title bar, status bar, spinners, content area

import { moveTo, cols, rows } from "./terminal.js"
import { theme } from "./theme.js"
import type { Spinner } from "../types.js"

const SPINNER_FRAMES: string[] = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export function drawTitleBar(text: string): void {
	const w: number = cols()
	const maxLen = w - 2
	const display = text.length > maxLen ? text.slice(0, maxLen - 3) + "..." : text
	moveTo(1, 1)
	process.stdout.write(`\x1b[7m${theme.bold} ${display.padEnd(w - 1)}${theme.reset}`)
}

export function drawStatusBar(text: string): void {
	const w: number = cols()
	const r: number = rows()
	moveTo(r, 1)
	process.stdout.write(`${theme.dim} ${text.padEnd(w - 1)}${theme.reset}`)
}

export function drawLoading(message: string = "Loading..."): void {
	const w: number = cols()
	const r: number = rows()
	const midRow: number = Math.floor(r / 2)
	const padded: string =
		message.length < w ? " ".repeat(Math.floor((w - message.length) / 2)) + message : message.slice(0, w)
	moveTo(midRow, 1)
	process.stdout.write(`${theme.dim}${padded}${theme.reset}`)
}

export function startSpinner(message: string = "Loading"): Spinner {
	const w: number = cols()
	const r: number = rows()
	const midRow: number = Math.floor(r / 2)
	let frame: number = 0
	let stopped: boolean = false

	function draw(): void {
		if (stopped) return
		const maxMsg = w - 6
		const safeMsg = message.length > maxMsg ? message.slice(0, maxMsg - 3) + "..." : message
		const spinner: string = `${theme.accentBold}${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]}${theme.reset}`
		const text: string = ` ${spinner} ${safeMsg}`
		const padded: string = " ".repeat(Math.max(0, Math.floor((w - safeMsg.length - 4) / 2))) + text
		moveTo(midRow, 1)
		process.stdout.write("\x1b[2K" + padded)
		frame++
	}

	draw()
	const interval: ReturnType<typeof setInterval> = setInterval(draw, 80)

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

export function clearContent(): void {
	const w: number = cols()
	const r: number = rows()
	const blank: string = " ".repeat(w)
	for (let i = 2; i < r; i++) {
		moveTo(i, 1)
		process.stdout.write(blank)
	}
}

export function contentRows(): number {
	return rows() - 2
}
