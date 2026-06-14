// Pure geometry helpers for laying out regions. No I/O. All rects are 0-based,
// with (x, y) the top-left cell and (w, h) the size in cells.

export interface Rect {
	x: number
	y: number
	w: number
	h: number
}

// A rect of size w×h centered inside `outer` (clamped to outer bounds).
export function center(outer: Rect, w: number, h: number): Rect {
	const cw = Math.min(w, outer.w)
	const ch = Math.min(h, outer.h)
	return {
		x: outer.x + Math.max(0, Math.floor((outer.w - cw) / 2)),
		y: outer.y + Math.max(0, Math.floor((outer.h - ch) / 2)),
		w: cw,
		h: ch,
	}
}

// Center only horizontally, keeping the given top `y`.
export function centerX(outer: Rect, w: number, y: number): Rect {
	const cw = Math.min(w, outer.w)
	return { x: outer.x + Math.max(0, Math.floor((outer.w - cw) / 2)), y, w: cw, h: 1 }
}

// `count` single-row slots stacked vertically from the top of `rect`, with
// `spacing` blank rows between them. Each slot is full-width and one row tall.
export function stack(rect: Rect, count: number, spacing = 0): Rect[] {
	const slots: Rect[] = []
	for (let i = 0; i < count; i++) {
		slots.push({ x: rect.x, y: rect.y + i * (1 + spacing), w: rect.w, h: 1 })
	}
	return slots
}

// Shrink a rect inward by `p` cells on every side (or by dx/dy independently).
export function inset(rect: Rect, dx: number, dy: number = dx): Rect {
	return {
		x: rect.x + dx,
		y: rect.y + dy,
		w: Math.max(0, rect.w - dx * 2),
		h: Math.max(0, rect.h - dy * 2),
	}
}

// Split off `n` rows from the top: returns [top, rest].
export function splitTop(rect: Rect, n: number): [Rect, Rect] {
	const k = Math.min(n, rect.h)
	return [
		{ x: rect.x, y: rect.y, w: rect.w, h: k },
		{ x: rect.x, y: rect.y + k, w: rect.w, h: rect.h - k },
	]
}

// Split off `n` rows from the bottom: returns [rest, bottom].
export function splitBottom(rect: Rect, n: number): [Rect, Rect] {
	const k = Math.min(n, rect.h)
	return [
		{ x: rect.x, y: rect.y, w: rect.w, h: rect.h - k },
		{ x: rect.x, y: rect.y + rect.h - k, w: rect.w, h: k },
	]
}
