// Display-width utilities — ANSI-aware, East-Asian-wide aware. Zero-dependency.

// Matches CSI SGR (and other CSI) sequences plus OSC sequences.
const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g

export function stripAnsi(str: string): string {
	return str.replace(ANSI_RE, "")
}

// Width of a single code point: 0 (combining/zero-width), 1 (normal), or 2 (wide).
export function charWidth(cp: number): number {
	if (cp === 0) return 0
	// C0/C1 control characters render as nothing useful here.
	if (cp < 32 || (cp >= 0x7f && cp < 0xa0)) return 0
	// Zero-width / combining ranges (compact, common subset).
	if (
		(cp >= 0x0300 && cp <= 0x036f) || // combining diacritical marks
		(cp >= 0x0483 && cp <= 0x0489) ||
		(cp >= 0x0591 && cp <= 0x05bd) ||
		(cp >= 0x0610 && cp <= 0x061a) ||
		(cp >= 0x064b && cp <= 0x065f) ||
		(cp >= 0x06ea && cp <= 0x06ed) ||
		cp === 0x200b || // zero-width space
		(cp >= 0x200c && cp <= 0x200f) ||
		(cp >= 0xfe00 && cp <= 0xfe0f) || // variation selectors
		cp === 0xfeff
	) {
		return 0
	}
	// East-Asian Wide / Fullwidth + common emoji blocks (rendered double-width).
	if (
		(cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
		(cp >= 0x2e80 && cp <= 0x303e) || // CJK radicals … symbols
		(cp >= 0x3041 && cp <= 0x33ff) || // Hiragana … CJK compat
		(cp >= 0x3400 && cp <= 0x4dbf) || // CJK ext A
		(cp >= 0x4e00 && cp <= 0x9fff) || // CJK unified
		(cp >= 0xa000 && cp <= 0xa4cf) || // Yi
		(cp >= 0xac00 && cp <= 0xd7a3) || // Hangul syllables
		(cp >= 0xf900 && cp <= 0xfaff) || // CJK compat ideographs
		(cp >= 0xfe30 && cp <= 0xfe4f) || // CJK compat forms
		(cp >= 0xff00 && cp <= 0xff60) || // Fullwidth forms
		(cp >= 0xffe0 && cp <= 0xffe6) ||
		(cp >= 0x1f300 && cp <= 0x1faff) || // emoji & pictographs
		(cp >= 0x20000 && cp <= 0x3fffd) // CJK ext B+
	) {
		return 2
	}
	return 1
}

// Visible width of a string in terminal columns, ignoring ANSI escapes.
export function displayWidth(str: string): number {
	let w = 0
	for (const ch of stripAnsi(str)) {
		w += charWidth(ch.codePointAt(0) as number)
	}
	return w
}

// Truncate to `max` display columns, appending `ellipsis` if anything was cut.
// ANSI escape sequences pass through without counting and a reset is appended
// when present so trailing truncation can't leak styling.
export function truncate(str: string, max: number, ellipsis = "…"): string {
	if (max <= 0) return ""
	if (displayWidth(str) <= max) return str

	const ellWidth = displayWidth(ellipsis)
	const budget = Math.max(0, max - ellWidth)

	let out = ""
	let w = 0
	let hadAnsi = false
	let i = 0
	while (i < str.length) {
		ANSI_RE.lastIndex = i
		const m = ANSI_RE.exec(str)
		if (m && m.index === i) {
			out += m[0]
			hadAnsi = true
			i += m[0].length
			continue
		}
		const cp = str.codePointAt(i) as number
		const cw = charWidth(cp)
		if (w + cw > budget) break
		out += String.fromCodePoint(cp)
		w += cw
		i += cp > 0xffff ? 2 : 1
	}
	return out + (hadAnsi ? "\x1b[0m" : "") + ellipsis
}

// Word-wrap plain text to `width` columns, returning at most `maxLines` lines.
// If content remains beyond maxLines, the last line ends with an ellipsis.
// Intended for short, unstyled strings like titles.
export function wrap(text: string, width: number, maxLines = Infinity): string[] {
	if (width <= 0) return []
	const words = text.split(/\s+/).filter(Boolean)
	const lines: string[] = []
	let line = ""
	const flush = () => {
		if (line) lines.push(line)
		line = ""
	}
	for (const word of words) {
		const candidate = line ? `${line} ${word}` : word
		if (displayWidth(candidate) <= width) {
			line = candidate
			continue
		}
		flush()
		// Hard-break a single word that is wider than the column.
		let w = word
		while (displayWidth(w) > width) {
			const head = truncate(w, width, "")
			lines.push(head)
			w = w.slice(head.length)
		}
		line = w
	}
	flush()
	if (lines.length > maxLines) {
		lines.length = maxLines
		lines[maxLines - 1] = truncate(lines[maxLines - 1], width)
	}
	return lines
}
