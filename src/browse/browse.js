// Browse mode orchestrator — wires screens, state, and video selection

import { enterRawMode, setTitle, clearScreen } from "../tui/terminal.js"
import { drawTitleBar, startSpinner, clearContent, drawStatusBar } from "../tui/screen.js"
import {
	fetchPlaylists,
	fetchPlaylistVideos,
	fetchPlaylistCount,
	fetchSubscriptions,
	fetchRecommendations,
	fetchHistory,
	fetchAccountName,
} from "./data.js"
import { resolveInput } from "../resolve.js"
import { probe } from "../probe.js"
import { createBrowseState } from "./state.js"
import { createMainMenu } from "./screens/main-menu.js"
import { showVideoList, showPlaylistList, showPlaylistVideos } from "./screens/video-list.js"
import { createSearchScreen } from "./screens/search.js"

export async function browse() {
	enterRawMode()

	const state = createBrowseState()

	drawTitleBar("PixelTube")
	const startupSpinner = startSpinner("Starting PixelTube")

	let accountName = null
	try {
		accountName = await fetchAccountName()
	} catch {}
	startupSpinner.stop()

	setTitle(accountName ? `PixelTube (${accountName})` : "PixelTube")

	function headerPrefix() {
		return accountName ? `PixelTube [${accountName}]` : "PixelTube"
	}

	const resizeHandler = () => {
		const cur = state.currentState()
		if (cur) {
			clearScreen()
			state.renderCurrent()
		}
	}
	process.stdout.on("resize", resizeHandler)

	async function selectVideo(video, playlist = null) {
		const url = `https://www.youtube.com/watch?v=${video.id}`
		const info = {
			title: video.title,
			channel: video.channel,
			duration: Number(video.duration) || 0,
			videoUrl: url,
		}

		clearContent()
		drawTitleBar(`${headerPrefix()} > Now loading...`)
		const spinner = startSpinner(`Preparing "${video.title}"`)
		drawStatusBar(" Resolving stream...")

		try {
			const resolved = await resolveInput(url, {
				onStatus: (msg) => spinner.update(msg),
			})
			const meta = resolved.meta || (await probe(resolved.streamUrl))
			if (!info.channel && meta.channel) info.channel = meta.channel

			spinner.stop()

			state.exitForPlayback(resizeHandler)
			state.result({
				url,
				info,
				streamUrl: resolved.streamUrl,
				meta,
				cleanup: resolved.cleanup,
				playlist,
			})
		} catch (err) {
			spinner.stop()
			state.flashMessage(`Error: ${err.message}`)
		}
	}

	const searchScreen = createSearchScreen(state, headerPrefix, selectVideo)

	function onMenuAction(action) {
		if (action === "playlists") {
			showPlaylistList(state, headerPrefix(), fetchPlaylists, fetchPlaylistCount, (playlist) => {
				showPlaylistVideos(state, headerPrefix(), playlist, fetchPlaylistVideos, selectVideo)
			})
		} else if (action === "subscriptions") {
			showVideoList(state, headerPrefix(), "Subscriptions", fetchSubscriptions, selectVideo)
		} else if (action === "recommendations") {
			showVideoList(state, headerPrefix(), "Recommendations", fetchRecommendations, selectVideo)
		} else if (action === "history") {
			showVideoList(state, headerPrefix(), "History", fetchHistory, selectVideo)
		} else if (action === "search") {
			searchScreen.show()
		}
	}

	const mainMenu = createMainMenu(state, accountName, onMenuAction)

	state.setKeyHandler((key) => {
		if (key === "ctrl-c") return state.result(null)
		if (key === "q") return state.result(null)

		const cur = state.currentState()
		if (!cur) return state.result(null)

		if (cur.render === mainMenu.draw) {
			return mainMenu.handleKey(key)
		}

		if (cur.type === "SEARCH_INPUT") {
			return searchScreen.handleKey(key)
		}

		if (cur.listView) {
			cur.listView.handleKey(key)
			return
		}

		if (key === "escape" || key === "left") {
			state.popState()
		}
	})

	mainMenu.show()
	const firstResult = await state.start()

	return {
		selection: firstResult,
		resume: () => {
			enterRawMode()
			process.stdout.on("resize", resizeHandler)
			state.renderCurrent()
			return state.resume(resizeHandler)
		},
	}
}
