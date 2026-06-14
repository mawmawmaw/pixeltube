// Help overlay — a centered panel of keyboard shortcuts. Pushed onto the browse
// stack with type "HELP"; any key closes it (handled in browse.ts).

import type { BrowseState } from "../../types.js"
import { contentScreen } from "../../tui/screen.js"
import { theme } from "../../tui/theme.js"
import { center } from "../../tui/layout.js"
import { drawBox } from "../../tui/components/box.js"

const SHORTCUTS: Array<[string, string]> = [
	["↑ / ↓", "Move selection"],
	["wheel", "Scroll"],
	["enter / →", "Select / open"],
	["esc / ←", "Back"],
	["/", "Filter the list"],
	["tab", "Search filters (in search)"],
	["?", "Toggle this help"],
	["q", "Quit"],
]

export function createHelpScreen(browseState: BrowseState) {
	function draw(): void {
		const buf = contentScreen()
		buf.fill({ x: 0, y: 0, w: buf.width, h: buf.height }, " ", "")

		const innerW = Math.min(44, buf.width - 4)
		const boxW = innerW + 4
		const boxH = SHORTCUTS.length + 4
		const box = center({ x: 0, y: 0, w: buf.width, h: buf.height }, boxW, boxH)
		drawBox(buf, box, theme.accent)

		buf.put(box.x + 2, box.y + 1, `${theme.accentBold}Keyboard shortcuts${theme.reset}`)
		for (let i = 0; i < SHORTCUTS.length; i++) {
			const [keys, desc] = SHORTCUTS[i]
			const y = box.y + 3 + i
			buf.put(box.x + 2, y, `${theme.bold}${keys}${theme.reset}`)
			buf.put(box.x + 14, y, `${theme.dim}${desc}${theme.reset}`)
		}
		buf.flush()
	}

	return {
		open(): void {
			browseState.pushState({
				title: () => "PixelTube > Help",
				type: "HELP",
				statusHint: " press any key to close",
				render: draw,
			})
		},
		close(): void {
			browseState.popState()
		},
	}
}
