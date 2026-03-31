// Main menu screen with responsive ASCII logo and menu items

import { moveTo, cols, rows, syncStart, syncEnd } from "../../tui/terminal.js"
import { contentRows } from "../../tui/screen.js"
import { theme } from "../../tui/theme.js"

const DIM = theme.dim
const BOLD = theme.bold
const RESET = theme.reset

const MENU_ITEMS = [
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

function getLayout(r, w) {
	const totalRows = r + 2
	if (totalRows >= 25 && w >= 85) return { logo: "large", spacing: 1 }
	if (totalRows >= 21 && w >= 85) return { logo: "large", spacing: 0 }
	if (totalRows >= 19 && w >= 48) return { logo: "medium", spacing: 0 }
	if (totalRows >= 13 && w >= 22) return { logo: "small", spacing: 0 }
	return { logo: "text", spacing: 0 }
}

function drawLogo(logoLines, logoWidth, r, w, menuLines) {
	const logoStart = Math.max(2, Math.floor((r - logoLines.length - 1 - menuLines) / 2) + 1)
	for (let i = 0; i < logoLines.length; i++) {
		moveTo(logoStart + i, Math.max(1, Math.floor((w - logoWidth) / 2)))
		process.stdout.write(`${theme.accentBold}${logoLines[i]}${RESET}`)
	}
	return logoStart + logoLines.length + 1
}

export function createMainMenu(browseState, accountName, onAction) {
	function show() {
		browseState.pushState({
			title: () => (accountName ? `PixelTube [${accountName}]` : "PixelTube"),
			statusHint: " arrows: navigate | enter/right: select | q: quit",
			listView: null,
			render: draw,
			selectedIdx: 0,
		})
	}

	function draw() {
		const w = cols()
		const r = contentRows()
		const state = browseState.currentState()
		const items = MENU_ITEMS

		syncStart()

		const { logo: logoMode, spacing } = getLayout(r, w)
		const menuLines = items.length * (spacing + 1)
		let menuStart

		if (logoMode === "large") {
			menuStart = drawLogo(LARGE_LOGO, 83, r, w, menuLines)
		} else if (logoMode === "medium") {
			menuStart = drawLogo(MEDIUM_LOGO, 47, r, w, menuLines)
		} else if (logoMode === "small") {
			menuStart = drawLogo(SMALL_LOGO, 18, r, w, menuLines)
		} else {
			const titleText = `${theme.logoYellow}PixelTube${RESET}`
			const titleStart = Math.max(2, Math.floor((r - 2 - menuLines) / 2) + 1)
			moveTo(titleStart, Math.floor((w - 9) / 2))
			process.stdout.write(titleText)
			menuStart = titleStart + 2
		}

		const menuWidth = Math.min(50, w - 4)
		const indent = Math.floor((w - menuWidth) / 2)

		for (let i = 0; i < items.length; i++) {
			const item = items[i]
			const y = menuStart + i * (spacing + 1)
			const arrow = i === state.selectedIdx ? `${theme.selArrow}>` : " "
			const line = `  ${arrow}${RESET}  ${BOLD}${item.label}${RESET}  ${DIM}${item.desc}${RESET}`
			const visLen = item.label.length + item.desc.length + 7
			const pad = Math.max(0, menuWidth - visLen)

			moveTo(y, indent)
			if (i === state.selectedIdx) {
				process.stdout.write(`${theme.selBg}${line}${" ".repeat(pad)}${RESET}`)
			} else {
				process.stdout.write(line)
			}
		}

		if (accountName) {
			const acctText = `Logged in as ${accountName} `
			const statusHintLen = 52
			if (w > statusHintLen + acctText.length) {
				moveTo(rows(), w - acctText.length)
				process.stdout.write(`${DIM}${acctText}${RESET}`)
			} else if (w > acctText.length + 2) {
				moveTo(rows() - 1, w - acctText.length)
				process.stdout.write(`${DIM}${acctText}${RESET}`)
			}
		}

		syncEnd()
		state._menuItems = items
	}

	function handleKey(key) {
		const state = browseState.currentState()
		const items = state._menuItems || MENU_ITEMS
		if (key === "up") {
			if (state.selectedIdx > 0) state.selectedIdx--
			draw()
		} else if (key === "down") {
			if (state.selectedIdx < items.length - 1) state.selectedIdx++
			draw()
		} else if (key === "enter" || key === "right") {
			const item = items[state.selectedIdx]
			if (item) onAction(item.action)
		} else if (key === "escape" || key === "left") {
			browseState.result(null)
		}
	}

	return { show, draw, handleKey }
}
