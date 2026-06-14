// Shared box-drawing helper for bordered panes/overlays.

import type { Screen } from "../buffer.js"
import type { Rect } from "../layout.js"
import { theme } from "../theme.js"

export function drawBox(buf: Screen, rect: Rect, style: string = theme.dim): void {
	const { x, y, w, h } = rect
	if (w < 2 || h < 2) return
	buf.put(x, y, `┌${"─".repeat(w - 2)}┐`, style)
	buf.put(x, y + h - 1, `└${"─".repeat(w - 2)}┘`, style)
	for (let i = 1; i < h - 1; i++) {
		buf.put(x, y + i, "│", style)
		buf.put(x + w - 1, y + i, "│", style)
	}
}
