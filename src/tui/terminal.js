// Terminal I/O — raw mode, escape sequences, key parsing, screen management

import { altScreen, syncOutput } from "./theme.js"

export function checkTTY() {
	if (!process.stdout.isTTY) {
		console.error("PixelTube requires an interactive terminal (TTY).")
		console.error("Pipe and redirect are not supported.")
		process.exit(1)
	}
}

export function enterRawMode() {
	if (!process.stdin.isTTY) return
	process.stdin.setRawMode(true)
	process.stdin.resume()
	process.stdin.setEncoding("utf8")
	enterAltScreen()
	hideCursor()
	clearScreen()
}

export function exitRawMode() {
	showCursor()
	exitAltScreen()
	if (process.stdin.isTTY) process.stdin.setRawMode(false)
	process.stdin.pause()
}

export function enterAltScreen() {
	if (altScreen) process.stdout.write("\x1b[?1049h")
}

export function exitAltScreen() {
	if (altScreen) process.stdout.write("\x1b[?1049l")
}

export function showCursor() {
	process.stdout.write("\x1b[?25h")
}

export function hideCursor() {
	process.stdout.write("\x1b[?25l")
}

export function clearScreen() {
	process.stdout.write("\x1b[2J")
}

export function resetStyle() {
	process.stdout.write("\x1b[0m")
}

export function clearLineAt(row) {
	moveTo(row, 1)
	process.stdout.write("\x1b[2K")
}

export function syncStart() {
	if (syncOutput) process.stdout.write("\x1b[?2026h")
}

export function syncEnd() {
	if (syncOutput) process.stdout.write("\x1b[?2026l")
}

export function parseKey(data) {
	if (data === "\x03") return "ctrl-c"
	if (data === "\x1b" || data === "\x1b\x1b") return "escape"
	if (data === "\r") return "enter"
	if (data === "\x7f" || data === "\b") return "backspace"
	if (data === "\x1b[A") return "up"
	if (data === "\x1b[B") return "down"
	if (data === "\x1b[C") return "right"
	if (data === "\x1b[D") return "left"
	if (data === "\t") return "tab"
	if (data.length === 1 && data.charCodeAt(0) >= 32 && data.charCodeAt(0) <= 126) return data
	return null
}

export function onKey(callback) {
	const handler = (data) => {
		const key = parseKey(data)
		if (key) callback(key)
	}
	process.stdin.on("data", handler)
	return () => process.stdin.removeListener("data", handler)
}

export function moveTo(row, col) {
	process.stdout.write(`\x1b[${row};${col}H`)
}

export const clearLine = clearLineAt

export function setTitle(title) {
	process.stdout.write(`\x1b]0;${title}\x07`)
}

export function cols() {
	return process.stdout.columns || 80
}

export function rows() {
	return process.stdout.rows || 24
}

export function emergencyRestore() {
	try {
		resetStyle()
		showCursor()
		exitAltScreen()
		if (process.stdin.isTTY && process.stdin.isRaw) process.stdin.setRawMode(false)
	} catch {}
}
