// Double-buffered cell grid with diff-based flushing. Only changed cells are
// emitted on flush, eliminating full-screen repaints (and the flicker they
// cause). Styles are plain ANSI prefix strings, mirroring src/tui/theme.ts.

import { syncOutput } from "./theme.js"
import { charWidth } from "./width.js"
import type { Rect } from "./layout.js"

const RESET = "\x1b[0m"
const SYNC_START = syncOutput ? "\x1b[?2026h" : ""
const SYNC_END = syncOutput ? "\x1b[?2026l" : ""

// Matches a single SGR (style) sequence; other escapes are ignored in content.
const SGR_RE = /^\x1b\[[0-9;]*m/

interface Cell {
	ch: string // visible glyph (empty string = blank or wide-char tail)
	style: string // active ANSI prefix for this cell
	cont: boolean // true = right half of a preceding wide glyph
}

function blankCell(): Cell {
	return { ch: " ", style: "", cont: false }
}

export class Screen {
	width: number
	height: number
	// Terminal-cell offset applied on flush, so a buffer can occupy a sub-region
	// (e.g. the content area below the title bar) using local 0-based coords.
	originX: number
	originY: number
	private cells: Cell[]
	private prev: Cell[] | null = null
	private cursor: { x: number; y: number } | null = null

	constructor(width: number, height: number, originX = 0, originY = 0) {
		this.width = Math.max(1, width)
		this.height = Math.max(1, height)
		this.originX = originX
		this.originY = originY
		this.cells = this.allocate()
	}

	private allocate(): Cell[] {
		const n = this.width * this.height
		const arr: Cell[] = new Array(n)
		for (let i = 0; i < n; i++) arr[i] = blankCell()
		return arr
	}

	// Reallocate for a new terminal size and force a full repaint next flush.
	resize(width: number, height: number, originX = this.originX, originY = this.originY): void {
		this.width = Math.max(1, width)
		this.height = Math.max(1, height)
		this.originX = originX
		this.originY = originY
		this.cells = this.allocate()
		this.prev = null
		this.cursor = null
	}

	// Force the next flush to redraw every cell (e.g. after the screen was
	// clobbered by an external write).
	invalidate(): void {
		this.prev = null
	}

	// Reset every cell to blank for the next frame.
	clear(): void {
		for (let i = 0; i < this.cells.length; i++) {
			const c = this.cells[i]
			c.ch = " "
			c.style = ""
			c.cont = false
		}
		this.cursor = null
	}

	fill(rect: Rect, ch: string, style = ""): void {
		const x1 = Math.max(0, rect.x)
		const y1 = Math.max(0, rect.y)
		const x2 = Math.min(this.width, rect.x + rect.w)
		const y2 = Math.min(this.height, rect.y + rect.h)
		for (let y = y1; y < y2; y++) {
			for (let x = x1; x < x2; x++) {
				const c = this.cells[y * this.width + x]
				c.ch = ch
				c.style = style
				c.cont = false
			}
		}
	}

	// Write `text` (which may contain embedded SGR sequences) starting at (x, y).
	// `style` is the base style; embedded sequences layer on top and `\x1b[0m`
	// resets back to the base. Wide glyphs occupy two cells; the text is clipped
	// at the right edge.
	put(x: number, y: number, text: string, style = ""): void {
		if (y < 0 || y >= this.height) return
		let col = x
		let active = ""
		let i = 0
		while (i < text.length) {
			if (text[i] === "\x1b") {
				const m = SGR_RE.exec(text.slice(i))
				if (m) {
					active = m[0] === RESET ? "" : active + m[0]
					i += m[0].length
					continue
				}
			}
			const cp = text.codePointAt(i) as number
			i += cp > 0xffff ? 2 : 1
			const cw = charWidth(cp)
			if (cw === 0) continue // skip combining/zero-width for cell placement
			if (col + cw > this.width) break
			if (col >= 0) {
				const head = this.cells[y * this.width + col]
				head.ch = String.fromCodePoint(cp)
				head.style = style + active
				head.cont = false
				if (cw === 2) {
					const tail = this.cells[y * this.width + col + 1]
					tail.ch = ""
					tail.style = style + active
					tail.cont = true
				}
			}
			col += cw
		}
	}

	// Request a visible hardware cursor at (x, y) after the next flush.
	setCursor(x: number, y: number): void {
		this.cursor = { x, y }
	}

	clearCursor(): void {
		this.cursor = null
	}

	// Diff against the previously flushed frame and write only what changed.
	// Returns the emitted string (also written to stdout) for inspection/tests.
	flush(): string {
		const parts: string[] = [SYNC_START]
		const prev = this.prev
		for (let y = 0; y < this.height; y++) {
			let pendingMove = true
			let curStyle: string | null = null
			for (let x = 0; x < this.width; x++) {
				const idx = y * this.width + x
				const cell = this.cells[idx]
				if (cell.cont) continue // tail of a wide glyph — cursor already advanced
				const p = prev ? prev[idx] : null
				const changed = !p || p.ch !== cell.ch || p.style !== cell.style || p.cont !== cell.cont
				if (!changed) {
					pendingMove = true
					continue
				}
				if (pendingMove) {
					parts.push(`\x1b[${this.originY + y + 1};${this.originX + x + 1}H`)
					pendingMove = false
					curStyle = null
				}
				if (cell.style !== curStyle) {
					parts.push(RESET + cell.style)
					curStyle = cell.style
				}
				parts.push(cell.ch === "" ? " " : cell.ch)
			}
			if (curStyle) parts.push(RESET)
		}
		if (this.cursor) {
			parts.push(`\x1b[${this.originY + this.cursor.y + 1};${this.originX + this.cursor.x + 1}H\x1b[?25h`)
		}
		parts.push(SYNC_END)
		this.snapshot()
		const out = parts.join("")
		process.stdout.write(out)
		return out
	}

	private snapshot(): void {
		const n = this.cells.length
		const snap: Cell[] = new Array(n)
		for (let i = 0; i < n; i++) {
			const c = this.cells[i]
			snap[i] = { ch: c.ch, style: c.style, cont: c.cont }
		}
		this.prev = snap
	}
}
