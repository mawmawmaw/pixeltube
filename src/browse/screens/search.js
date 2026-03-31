// Search screen with text input, filters, and result display

import { moveTo, clearLine, cols, rows, showCursor, hideCursor } from "../../tui/terminal.js"
import { drawTitleBar, startSpinner, drawStatusBar, clearContent } from "../../tui/screen.js"
import { createListView } from "../../tui/list-view.js"
import { search } from "../data.js"
import { theme } from "../../tui/theme.js"
import { formatVideoItem } from "../format.js"

const DIM = theme.dim
const BOLD = theme.bold
const RESET = theme.reset

const FILTER_OPTIONS = {
	sort: ["relevance", "date", "views", "rating"],
	duration: ["any", "short", "medium", "long"],
}

export function createSearchScreen(browseState, headerPrefix, onSelectVideo) {
	let searchBuffer = ""
	let filterMode = false
	let filterField = 0
	let searchFilters = { sort: "relevance", duration: "any" }

	function show() {
		searchBuffer = ""
		filterMode = false

		browseState.pushState({
			title: () => `${headerPrefix()} > Search`,
			type: "SEARCH_INPUT",
			statusHint: " type query | enter: search | tab: filters | esc: back",
			listView: null,
		})
		renderInput()
	}

	function renderInput() {
		const r = Math.floor(rows() / 2)
		const w = cols()
		clearLine(r - 2)
		clearLine(r - 1)
		clearLine(r)
		clearLine(r + 1)
		clearLine(r + 2)
		clearLine(r + 3)

		moveTo(r, 1)
		const prompt = `  ${BOLD}Search:${RESET} ${searchBuffer}${DIM}_${RESET}`
		process.stdout.write(prompt.length > w + 20 ? prompt.slice(0, w) : prompt)

		const sortLabel = `Sort: ${searchFilters.sort}`
		const durLabel = `Duration: ${searchFilters.duration}`
		moveTo(r + 2, 3)
		if (filterMode && filterField === 0) {
			process.stdout.write(`${theme.accentBold}> ${sortLabel}${RESET}`)
		} else {
			process.stdout.write(`${DIM}  ${sortLabel}${RESET}`)
		}
		moveTo(r + 3, 3)
		if (filterMode && filterField === 1) {
			process.stdout.write(`${theme.accentBold}> ${durLabel}${RESET}`)
		} else {
			process.stdout.write(`${DIM}  ${durLabel}${RESET}`)
		}

		showCursor()
		moveTo(r, 11 + searchBuffer.length)
	}

	async function executeSearch(query) {
		hideCursor()
		clearContent()
		drawTitleBar(`${headerPrefix()} > Search > "${query}"`)
		const spinner = startSpinner("Searching")
		drawStatusBar(" Please wait...")

		const filters =
			searchFilters.sort !== "relevance" || searchFilters.duration !== "any"
				? {
						sort: searchFilters.sort === "relevance" ? null : searchFilters.sort,
						duration: searchFilters.duration === "any" ? null : searchFilters.duration,
					}
				: null

		try {
			const videos = await search(query, filters)
			spinner.stop()
			if (videos.length === 0) {
				return browseState.flashMessage("No results found")
			}

			const listView = createListView({
				items: videos,
				formatItem: formatVideoItem,
				onSelect: (video, idx) => onSelectVideo(video, { videos, index: idx }),
				onBack: () => browseState.popState(),
				spacing: 1,
			})

			browseState.pushState({
				title: () => `${headerPrefix()} > Search > "${query}"`,
				listView,
			})
		} catch (err) {
			spinner.stop()
			browseState.flashMessage(`Error: ${err.message}`)
		}
	}

	function handleKey(key) {
		if (filterMode) {
			const fields = ["sort", "duration"]
			const field = fields[filterField]
			const opts = FILTER_OPTIONS[field]
			const curIdx = opts.indexOf(searchFilters[field])
			if (key === "tab" || key === "escape") {
				filterMode = false
			} else if (key === "up") {
				filterField = Math.max(0, filterField - 1)
			} else if (key === "down") {
				filterField = Math.min(fields.length - 1, filterField + 1)
			} else if (key === "left") {
				searchFilters[field] = opts[(curIdx - 1 + opts.length) % opts.length]
			} else if (key === "right" || key === "enter") {
				searchFilters[field] = opts[(curIdx + 1) % opts.length]
			}
			renderInput()
			return
		}
		if (key === "escape" || key === "left") {
			hideCursor()
			browseState.popState()
		} else if (key === "tab") {
			filterMode = true
			filterField = 0
			renderInput()
		} else if (key === "enter" && searchBuffer.trim()) {
			executeSearch(searchBuffer.trim())
		} else if (key === "backspace") {
			searchBuffer = searchBuffer.slice(0, -1)
			renderInput()
		} else if (key.length === 1) {
			searchBuffer += key
			renderInput()
		}
	}

	return {
		show,
		handleKey,
		get isSearch() {
			return true
		},
	}
}
