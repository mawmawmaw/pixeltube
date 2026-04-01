// Search screen with text input, filters, and result display

import type { BrowseState, Video, Playlist, PlaylistContext, SearchFilters, SearchResult } from "../../types.js"
import { moveTo, clearLine, cols, rows, showCursor, hideCursor } from "../../tui/terminal.js"
import { drawTitleBar, startSpinner, drawStatusBar, clearContent } from "../../tui/screen.js"
import { createListView } from "../../tui/list-view.js"
import { search } from "../data.js"
import { theme } from "../../tui/theme.js"
import { formatSearchResult } from "../format.js"

const DIM = theme.dim
const BOLD = theme.bold
const RESET = theme.reset

const FILTER_OPTIONS: Record<string, string[]> = {
	sort: ["relevance", "date", "views", "rating"],
	duration: ["any", "short", "medium", "long"],
	type: ["all", "video", "playlist", "channel"],
}

export function createSearchScreen(
	browseState: BrowseState,
	headerPrefix: () => string,
	onSelectVideo: (video: Video, context: PlaylistContext) => void,
	onSelectPlaylist: (playlist: Playlist) => void,
	onSelectChannel: (id: string, title: string) => void,
) {
	let searchBuffer = ""
	let filterMode = false
	let filterField = 0
	let searchFilters: Record<string, string> = { sort: "relevance", duration: "any", type: "all" }

	function show(): void {
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

	function renderInput(): void {
		const r = Math.floor(rows() / 2)
		const w = cols()
		clearLine(r - 2)
		clearLine(r - 1)
		clearLine(r)
		clearLine(r + 1)
		clearLine(r + 2)
		clearLine(r + 3)
		clearLine(r + 4)

		moveTo(r, 1)
		const prompt = `  ${BOLD}Search:${RESET} ${searchBuffer}${DIM}_${RESET}`
		process.stdout.write(prompt.length > w + 20 ? prompt.slice(0, w) : prompt)

		const fields = ["sort", "duration", "type"]
		const labels = [
			`Sort: ${searchFilters.sort}`,
			`Duration: ${searchFilters.duration}`,
			`Type: ${searchFilters.type}`,
		]
		for (let i = 0; i < fields.length; i++) {
			moveTo(r + 2 + i, 3)
			if (filterMode && filterField === i) {
				process.stdout.write(`${theme.accentBold}> ${labels[i]}${RESET}`)
			} else {
				process.stdout.write(`${DIM}  ${labels[i]}${RESET}`)
			}
		}

		showCursor()
		moveTo(r, 11 + searchBuffer.length)
	}

	async function executeSearch(query: string): Promise<void> {
		hideCursor()
		clearContent()
		drawTitleBar(`${headerPrefix()} > Search > "${query}"`)
		const spinner = startSpinner("Searching")
		drawStatusBar(" Please wait...")

		const hasFilters =
			searchFilters.sort !== "relevance" || searchFilters.duration !== "any" || searchFilters.type !== "all"
		const filters: SearchFilters | null = hasFilters
			? {
					sort: searchFilters.sort === "relevance" ? null : searchFilters.sort,
					duration: searchFilters.duration === "any" ? null : searchFilters.duration,
					type: searchFilters.type === "all" ? null : searchFilters.type,
				}
			: null

		try {
			const results = await search(query, filters)
			spinner.stop()
			if (results.length === 0) {
				return browseState.flashMessage("No results found")
			}

			const listView = createListView({
				items: results,
				formatItem: formatSearchResult,
				onSelect: (item: SearchResult) => {
					if (item.resultType === "video") {
						const videoResults = results.filter((r): r is SearchResult & { resultType: "video" } => r.resultType === "video")
						const videoIdx = videoResults.findIndex((r) => r.id === item.id)
						const videos: Video[] = videoResults.map((r) => ({
							id: r.id,
							title: r.title,
							channel: r.channel,
							duration: r.duration,
							durationFmt: r.durationFmt,
						}))
						onSelectVideo(videos[videoIdx], { videos, index: videoIdx })
					} else if (item.resultType === "playlist") {
						onSelectPlaylist({ id: item.id, title: item.title, videoCount: item.videoCount })
					} else if (item.resultType === "channel") {
						onSelectChannel(item.id, item.title)
					}
				},
				onBack: () => browseState.popState(),
				spacing: 1,
			})

			browseState.pushState({
				title: () => `${headerPrefix()} > Search > "${query}"`,
				listView,
			})
		} catch (err) {
			spinner.stop()
			browseState.flashMessage(`Error: ${(err as Error).message}`)
		}
	}

	function handleKey(key: string): void {
		if (filterMode) {
			const fields = ["sort", "duration", "type"]
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
