// Shared screen for displaying video/playlist lists with loading states

import { drawTitleBar, startSpinner, drawStatusBar, clearContent } from "../../tui/screen.js"
import { createListView } from "../../tui/list-view.js"
import { formatVideoItem, formatPlaylistItem } from "../format.js"

export async function showVideoList(browseState, headerPrefix, title, fetchFn, onSelect) {
	clearContent()
	drawTitleBar(`${headerPrefix} > ${title}`)
	const spinner = startSpinner(`Loading ${title.toLowerCase()}`)
	drawStatusBar(" Please wait...")

	browseState.pushState({
		title: () => `${headerPrefix} > ${title}`,
		render: () => drawStatusBar(" Please wait..."),
	})

	try {
		const videos = await fetchFn()
		spinner.stop()
		browseState.popState()
		if (videos.length === 0) {
			return browseState.flashMessage(`No ${title.toLowerCase()} found`)
		}

		const listView = createListView({
			items: videos,
			formatItem: formatVideoItem,
			onSelect: (video, idx) => onSelect(video, { videos, index: idx }),
			onBack: () => browseState.popState(),
			spacing: 1,
		})

		browseState.pushState({
			title: () => `${headerPrefix} > ${title}`,
			listView,
		})
	} catch (err) {
		spinner.stop()
		browseState.popState()
		browseState.flashMessage(`Error: ${err.message}`)
	}
}

export async function showPlaylistList(
	browseState,
	headerPrefix,
	fetchPlaylists,
	fetchPlaylistCount,
	onSelectPlaylist,
) {
	clearContent()
	drawTitleBar(`${headerPrefix} > Playlists`)
	const spinner = startSpinner("Loading playlists")
	drawStatusBar(" Please wait...")

	browseState.pushState({
		title: () => `${headerPrefix} > Playlists`,
		render: () => drawStatusBar(" Please wait..."),
	})

	try {
		const playlists = await fetchPlaylists()
		spinner.stop()
		browseState.popState()
		if (playlists.length === 0) {
			return browseState.flashMessage("No playlists found")
		}

		const listView = createListView({
			items: playlists,
			formatItem: formatPlaylistItem,
			onSelect: (playlist) => onSelectPlaylist(playlist),
			onBack: () => browseState.popState(),
			spacing: 1,
		})

		browseState.pushState({
			title: () => `${headerPrefix} > Playlists`,
			listView,
		})

		const CONCURRENCY = 5
		;(async () => {
			for (let start = 0; start < playlists.length; start += CONCURRENCY) {
				const batch = playlists.slice(start, start + CONCURRENCY)
				await Promise.all(
					batch.map((pl, j) => {
						const i = start + j
						return fetchPlaylistCount(pl.id).then((count) => {
							if (count != null) {
								playlists[i].videoCount = count
								const cur = browseState.currentState()
								if (cur && cur.listView === listView) listView.render()
							}
						})
					}),
				).catch(() => {})
			}
		})()
	} catch (err) {
		spinner.stop()
		browseState.popState()
		browseState.flashMessage(`Error: ${err.message}`)
	}
}

export async function showPlaylistVideos(browseState, headerPrefix, playlist, fetchPlaylistVideos, onSelect) {
	clearContent()
	drawTitleBar(`${headerPrefix} > Playlists > ${playlist.title}`)
	const spinner = startSpinner("Loading videos")
	drawStatusBar(" Please wait...")

	browseState.pushState({
		title: () => `${headerPrefix} > Playlists > ${playlist.title}`,
		render: () => drawStatusBar(" Please wait..."),
	})

	try {
		const videos = await fetchPlaylistVideos(playlist.id)
		spinner.stop()
		browseState.popState()
		if (videos.length === 0) {
			return browseState.flashMessage("No videos found")
		}

		const listView = createListView({
			items: videos,
			formatItem: formatVideoItem,
			onSelect: (video, idx) => onSelect(video, { videos, index: idx }),
			onBack: () => browseState.popState(),
			spacing: 1,
		})

		browseState.pushState({
			title: () => `${headerPrefix} > Playlists > ${playlist.title}`,
			listView,
		})
	} catch (err) {
		spinner.stop()
		browseState.popState()
		browseState.flashMessage(`Error: ${err.message}`)
	}
}
