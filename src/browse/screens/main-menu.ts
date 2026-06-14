// Main menu screen with responsive ASCII logo and menu items. Composes into the
// content-region buffer; item selection is handled by the Menu component.

import type { BrowseState } from "../../types.js"
import { moveTo, cols, rows } from "../../tui/terminal.js"
import { contentScreen } from "../../tui/screen.js"
import { theme } from "../../tui/theme.js"
import { displayWidth, truncate } from "../../tui/width.js"
import { createMenu, type MenuItem } from "../../tui/components/menu.js"
import { getUpdateNotice } from "../../cli/update-check.js"

const RESET = theme.reset
const DIM = theme.dim

const MENU_ITEMS: MenuItem[] = [
	{ label: "Recommendations", desc: "Videos picked for you", action: "recommendations" },
	{ label: "Subscriptions", desc: "Recent from your channels", action: "subscriptions" },
	{ label: "Playlists", desc: "Your saved playlists", action: "playlists" },
	{ label: "History", desc: "Recently watched", action: "history" },
	{ label: "Search", desc: "Search YouTube", action: "search" },
]

const LARGE_LOGO = [
	``,
	`            ███                       ████   █████               █████             `,
	`           ░░░                       ░░███  ░░███               ░░███              `,
	` ████████  ████  █████ █████  ██████  ░███  ███████   █████ ████ ░███████   ██████ `,
	`░░███░░███░░███ ░░███ ░░███  ███░░███ ░███ ░░░███░   ░░███ ░███  ░███░░███ ███░░███`,
	` ░███ ░███ ░███  ░░░█████░  ░███████  ░███   ░███     ░███ ░███  ░███ ░███░███████ `,
	` ░███ ░███ ░███   ███░░░███ ░███░░░   ░███   ░███ ███ ░███ ░███  ░███ ░███░███░░░  `,
	` ░███████  █████ █████ █████░░██████  █████  ░░█████  ░░████████ ████████ ░░██████ `,
	` ░███░░░  ░░░░░ ░░░░░ ░░░░░  ░░░░░░  ░░░░░    ░░░░░    ░░░░░░░░ ░░░░░░░░   ░░░░░░  `,
	` ░███                                                                              `,
	` █████                                                                             `,
	`░░░░░                                                                              `,
]

const MEDIUM_LOGO = [
	`                                             `,
	`                      ▄▄                      `,
	`                       ██ █▄       █▄         `,
	`       ▀▀              ██▄██▄      ██         `,
	` ████▄ ██▀██ ██▀ ▄█▀█▄ ██ ██ ██ ██ ████▄ ▄█▀█▄`,
	` ██ ██ ██  ███   ██▄█▀ ██ ██ ██ ██ ██ ██ ██▄█▀`,
	`▄████▀▄██▄██ ██▄▄▀█▄▄▄▄██▄██▄▀██▀█▄████▀▄▀█▄▄▄`,
	` ██                                           `,
	` ▀                                            `,
]

const SMALL_LOGO = [`  ▘    ▜ ▗   ▌   `, `▛▌▌▚▘█▌▐ ▜▘▌▌▛▌█▌`, `▙▌▌▞▖▙▖▐▖▐▖▙▌▙▌▙▖`, `▌                `]

function getLayout(totalRows: number, w: number): { logo: string; spacing: number } {
	if (totalRows >= 25 && w >= 85) return { logo: "large", spacing: 1 }
	if (totalRows >= 21 && w >= 85) return { logo: "large", spacing: 0 }
	if (totalRows >= 19 && w >= 48) return { logo: "medium", spacing: 0 }
	if (totalRows >= 13 && w >= 22) return { logo: "small", spacing: 0 }
	return { logo: "text", spacing: 0 }
}

export function createMainMenu(
	browseState: BrowseState,
	accountName: string | null,
	onAction: (action: string) => void,
	opts: { loggedIn?: boolean } = {},
) {
	const loggedIn = opts.loggedIn ?? true
	const items = loggedIn ? MENU_ITEMS : MENU_ITEMS.filter((item) => item.action === "search")

	const menu = createMenu({
		items,
		onSelect: (item) => {
			if (item.action) onAction(item.action)
		},
		onBack: () => browseState.result(null),
		onRepaint: draw,
	})

	function show(): void {
		browseState.pushState({
			title: () => (accountName ? `PixelTube [${accountName}]` : "PixelTube"),
			statusHint: " arrows: navigate | enter/right: select | ?: help | q: quit",
			listView: null,
			render: draw,
			handleKey,
		})
	}

	function drawLogoLines(
		buf: ReturnType<typeof contentScreen>,
		lines: string[],
		logoWidth: number,
		startY: number,
		w: number,
	): void {
		const x = Math.max(0, Math.floor((w - logoWidth) / 2))
		for (let i = 0; i < lines.length; i++) {
			buf.put(x, startY + i, `${theme.accentBold}${lines[i]}${RESET}`)
		}
	}

	function draw(): void {
		const buf = contentScreen()
		const w = buf.width
		const h = buf.height
		buf.fill({ x: 0, y: 0, w, h }, " ", "")

		const { logo: logoMode, spacing } = getLayout(h + 2, w)
		const menuLines = items.length * (spacing + 1)

		let menuStartY: number
		if (logoMode === "large" || logoMode === "medium" || logoMode === "small") {
			const lines = logoMode === "large" ? LARGE_LOGO : logoMode === "medium" ? MEDIUM_LOGO : SMALL_LOGO
			const logoWidth = logoMode === "large" ? 83 : logoMode === "medium" ? 47 : 18
			const block = lines.length + 1 + menuLines
			const logoStartY = Math.max(0, Math.floor((h - block) / 2))
			drawLogoLines(buf, lines, logoWidth, logoStartY, w)
			menuStartY = logoStartY + lines.length + 1
		} else {
			const titleStartY = Math.max(0, Math.floor((h - 2 - menuLines) / 2))
			buf.put(Math.floor((w - 9) / 2), titleStartY, `${theme.logoYellow}PixelTube${RESET}`)
			menuStartY = titleStartY + 2
		}

		menu.render(buf, { x: 0, y: menuStartY, w, h: h - menuStartY }, true)

		// Update notice occupies the last content row; otherwise show the account.
		const notice = getUpdateNotice()
		if (notice) {
			const trunc = truncate(notice, w)
			const pad = Math.max(0, Math.floor((w - displayWidth(trunc)) / 2))
			buf.put(pad, h - 1, `${theme.accentBold}${trunc}${RESET}`)
		}

		buf.flush()

		// Account name is drawn on the status row (outside the content buffer),
		// matching the original right-aligned placement.
		if (!notice && accountName) {
			const acctText = `Logged in as ${accountName} `
			const tw = cols()
			if (tw > 52 + acctText.length) {
				moveTo(rows(), tw - acctText.length)
				process.stdout.write(`${DIM}${acctText}${RESET}`)
			} else if (tw > acctText.length + 2) {
				moveTo(rows() - 1, tw - acctText.length)
				process.stdout.write(`${DIM}${acctText}${RESET}`)
			}
		}
	}

	function handleKey(key: string): void {
		menu.handleKey(key)
	}

	return { show, draw, handleKey }
}
