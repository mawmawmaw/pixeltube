// Browse mode orchestrator — wires screens, state, and video selection

import type { BrowseState, BrowseScreenState, Video, PlaylistContext, VideoMeta, BrowseResult } from "../types.js"
import { enterRawMode, setTitle, clearScreen } from "../tui/terminal.js"
import { drawTitleBar, startSpinner, clearContent, drawStatusBar } from "../tui/screen.js"
import {
	fetchPlaylists,
	fetchPlaylistVideosPage,
	fetchPlaylistCount,
	fetchSubscriptions,
	fetchRecommendations,
	fetchHistory,
	fetchAccountName,
	fetchChannelVideos,
} from "./data.js"
import { resolveInput } from "../resolve.js"
import { probe } from "../probe.js"
import { createBrowseState } from "./state.js"
import { createMainMenu } from "./screens/main-menu.js"
import { showVideoList, showPlaylistList, showPlaylistVideos } from "./screens/video-list.js"
import { createSearchScreen } from "./screens/search.js"
import { createHelpScreen } from "./screens/help.js"

export async function browse(opts: { loggedIn?: boolean } = {}): Promise<BrowseResult> {
	const loggedIn = opts.loggedIn ?? true
	enterRawMode()

	const state: BrowseState = createBrowseState()

	drawTitleBar("PixelTube")
	const startupSpinner = startSpinner("Starting PixelTube")

	let accountName: string | null = null
	if (loggedIn) {
		try {
			accountName = await fetchAccountName()
		} catch {}
	}
	startupSpinner.stop()

	setTitle(accountName ? `PixelTube (${accountName})` : "PixelTube")

	function headerPrefix(): string {
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

	async function selectVideo(video: Video, playlist: PlaylistContext | null = null): Promise<void> {
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
				onStatus: (msg: string) => spinner.update(msg),
			})
			const meta: VideoMeta = resolved.meta || (await probe(resolved.streamUrl))
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
			state.flashMessage(`Error: ${(err as Error).message}`)
		}
	}

	const searchScreen = createSearchScreen(
		state,
		headerPrefix,
		selectVideo,
		(playlist) => {
			showPlaylistVideos(state, headerPrefix(), playlist, fetchPlaylistVideosPage, selectVideo)
		},
		(channelId, channelTitle) => {
			showVideoList(state, headerPrefix(), channelTitle, () => fetchChannelVideos(channelId), selectVideo)
		},
	)

	function onMenuAction(action: string): void {
		if (action === "playlists") {
			showPlaylistList(state, headerPrefix(), fetchPlaylists, fetchPlaylistCount, (playlist) => {
				showPlaylistVideos(state, headerPrefix(), playlist, fetchPlaylistVideosPage, selectVideo)
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

	const mainMenu = createMainMenu(state, accountName, onMenuAction, { loggedIn })
	const helpScreen = createHelpScreen(state)

	// Route a single key to the active screen's handler, list, or default back.
	function routeToScreen(cur: BrowseScreenState, key: string): void {
		if (cur.handleKey) return cur.handleKey(key)
		if (cur.listView) return cur.listView.handleKey(key)
		if (key === "escape" || key === "left") state.popState()
	}

	state.setKeyHandler((key: string) => {
		if (key === "ctrl-c") return state.result(null)

		const cur = state.currentState()
		if (!cur) return state.result(null)

		// Help overlay: any key closes it; "?" opens it (when not typing).
		if (cur.type === "HELP") return helpScreen.close()

		const capturingText = cur.type === "SEARCH_INPUT" || cur.listView?.capturesText() === true
		if (key === "?" && !capturingText) return helpScreen.open()

		// Scroll wheel nudges the selection a few rows.
		if (key === "scroll-up" || key === "scroll-down") {
			const step = key === "scroll-up" ? "up" : "down"
			for (let i = 0; i < 3; i++) routeToScreen(cur, step)
			return
		}

		// "q" quits, except on screens capturing typed text (search, list filter).
		if (key === "q" && !capturingText) return state.result(null)

		routeToScreen(cur, key)
	})

	mainMenu.show()
	const firstResult = await state.start()

	return {
		selection: firstResult,
		resume: () => {
			enterRawMode()
			process.stdout.on("resize", resizeHandler)
			return state.resume(resizeHandler)
		},
	}
}
