// Shared screen for displaying video/playlist lists with loading states

import type { BrowseState, Video, Playlist, ListView, PlaylistContext } from "../../types.js"
import { drawTitleBar, startSpinner, drawStatusBar, clearContent } from "../../tui/screen.js"
import { createListView } from "../../tui/list-view.js"
import { formatVideoItem, formatPlaylistItem } from "../format.js"

export async function showVideoList(
	browseState: BrowseState,
	headerPrefix: string,
	title: string,
	fetchFn: () => Promise<Video[]>,
	onSelect: (video: Video, playlist: PlaylistContext) => void,
): Promise<void> {
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
			onSelect: (video: Video, idx: number) => onSelect(video, { videos, index: idx }),
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
		browseState.flashMessage(`Error: ${(err as Error).message}`)
	}
}

export async function showPlaylistList(
	browseState: BrowseState,
	headerPrefix: string,
	fetchPlaylists: () => Promise<Playlist[]>,
	fetchPlaylistCount: (id: string) => Promise<number | null>,
	onSelectPlaylist: (playlist: Playlist) => void,
): Promise<void> {
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

		const listView: ListView = createListView({
			items: playlists,
			formatItem: formatPlaylistItem,
			onSelect: (playlist: Playlist) => onSelectPlaylist(playlist),
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
		browseState.flashMessage(`Error: ${(err as Error).message}`)
	}
}

const PLAYLIST_PAGE_SIZE = 50

export async function showPlaylistVideos(
	browseState: BrowseState,
	headerPrefix: string,
	playlist: Playlist,
	fetchPlaylistVideos: (id: string, start: number, end: number) => Promise<Video[]>,
	onSelect: (video: Video, context: PlaylistContext) => void,
): Promise<void> {
	clearContent()
	drawTitleBar(`${headerPrefix} > Playlists > ${playlist.title}`)
	const spinner = startSpinner("Loading videos")
	drawStatusBar(" Please wait...")

	browseState.pushState({
		title: () => `${headerPrefix} > Playlists > ${playlist.title}`,
		render: () => drawStatusBar(" Please wait..."),
	})

	try {
		const videos = await fetchPlaylistVideos(playlist.id, 1, PLAYLIST_PAGE_SIZE)
		spinner.stop()
		browseState.popState()
		if (videos.length === 0) {
			return browseState.flashMessage("No videos found")
		}

		let nextStart = PLAYLIST_PAGE_SIZE + 1
		const allVideos = [...videos]

		const listView = createListView({
			items: videos,
			formatItem: formatVideoItem,
			onSelect: (video: Video, idx: number) => onSelect(video, { videos: allVideos, index: idx }),
			onBack: () => browseState.popState(),
			spacing: 1,
			hasMore: true,
			onLoadMore: () => {
				const start = nextStart
				const end = start + PLAYLIST_PAGE_SIZE - 1
				fetchPlaylistVideos(playlist.id, start, end)
					.then((moreVideos) => {
						allVideos.push(...moreVideos)
						listView.appendItems(moreVideos)
						if (moreVideos.length === 0) {
							listView.setHasMore(false)
						}
						nextStart = end + 1
					})
					.catch(() => {
						listView.setHasMore(false)
						listView.appendItems([])
					})
			},
		})

		browseState.pushState({
			title: () => `${headerPrefix} > Playlists > ${playlist.title}`,
			listView,
		})
	} catch (err) {
		spinner.stop()
		browseState.popState()
		browseState.flashMessage(`Error: ${(err as Error).message}`)
	}
}
