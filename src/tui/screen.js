// Screen primitives — title bar, status bar, spinners, content area

import { moveTo, cols, rows } from "./terminal.js"
import { theme } from "./theme.js"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export function drawTitleBar(text) {
	const w = cols()
	moveTo(1, 1)
	process.stdout.write(`\x1b[7m${theme.bold} ${text.padEnd(w - 1)}${theme.reset}`)
}

export function drawStatusBar(text) {
	const w = cols()
	const r = rows()
	moveTo(r, 1)
	process.stdout.write(`${theme.dim} ${text.padEnd(w - 1)}${theme.reset}`)
}

export function drawLoading(message = "Loading...") {
	const w = cols()
	const r = rows()
	const midRow = Math.floor(r / 2)
	const padded = message.length < w ? " ".repeat(Math.floor((w - message.length) / 2)) + message : message.slice(0, w)
	moveTo(midRow, 1)
	process.stdout.write(`${theme.dim}${padded}${theme.reset}`)
}

export function startSpinner(message = "Loading") {
	const w = cols()
	const r = rows()
	const midRow = Math.floor(r / 2)
	let frame = 0
	let stopped = false

	function draw() {
		if (stopped) return
		const spinner = `${theme.accentBold}${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]}${theme.reset}`
		const text = ` ${spinner} ${message}`
		const padded = " ".repeat(Math.max(0, Math.floor((w - message.length - 4) / 2))) + text
		moveTo(midRow, 1)
		process.stdout.write("\x1b[2K" + padded)
		frame++
	}

	draw()
	const interval = setInterval(draw, 80)

	return {
		stop() {
			stopped = true
			clearInterval(interval)
			moveTo(midRow, 1)
			process.stdout.write("\x1b[2K")
		},
		update(newMessage) {
			message = newMessage
		},
	}
}

export function clearContent() {
	const w = cols()
	const r = rows()
	const blank = " ".repeat(w)
	for (let i = 2; i < r; i++) {
		moveTo(i, 1)
		process.stdout.write(blank)
	}
}

export function contentRows() {
	return rows() - 2
}
