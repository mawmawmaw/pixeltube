// Command handlers for play, browse, login, and playlist URLs

import { execFileSync } from "node:child_process"
import { resolveInput } from "../resolve.js"
import { probe } from "../probe.js"
import { computeDimensions, createDecoder } from "../decoder.js"
import { play } from "../player.js"
import { enterAltScreen, exitAltScreen, hideCursor, clearScreen } from "../tui/terminal.js"

function checkFfmpeg() {
	try {
		execFileSync("ffmpeg", ["-version"], { stdio: "ignore" })
	} catch {
		console.error("ffmpeg not found. Install it: brew install ffmpeg")
		process.exit(1)
	}
	try {
		execFileSync("ffplay", ["-version"], { stdio: "ignore" })
	} catch {
		console.warn("Warning: ffplay not found. Audio playback will be unavailable.")
	}
}

function showLoading() {
	enterAltScreen()
	hideCursor()
	clearScreen()
}

function hideLoading() {
	exitAltScreen()
}

async function playVideo(url, opts = {}) {
	showLoading()
	const { startSpinner, drawTitleBar } = await import("../tui/screen.js")
	drawTitleBar("PixelTube > Loading...")
	const spinner = startSpinner("Preparing video")

	const {
		streamUrl,
		meta: remoteMeta,
		cleanup,
	} = await resolveInput(url, {
		download: opts.download || false,
		onStatus: (msg) => spinner.update(msg),
	})
	const meta = remoteMeta || (await probe(streamUrl))
	spinner.stop()
	hideLoading()

	const fps = opts.fps || meta.fps
	const termCols = opts.width || process.stdout.columns
	const { width, height } = computeDimensions(meta.width, meta.height, termCols, process.stdout.rows)

	const audio = opts.audio !== false
	const decoder = createDecoder(streamUrl, width, height, fps, { audio })
	const info = opts.info || {}
	if (!info.channel && meta.channel) info.channel = meta.channel
	const duration = meta.duration || info.duration || 0
	const playlist = opts.playlist || null
	const exitReason = await play(decoder, width, height, fps, { info, duration, playlist })
	if (cleanup) cleanup()
	return exitReason
}

export async function cmdLogin(ytdlp, cookieArgs) {
	const { verifyLogin } = await import("../login.js")
	await verifyLogin(ytdlp, cookieArgs)
	console.log("\nLaunching browse...\n")
	await cmdBrowse(ytdlp)
}

export async function cmdBrowse(ytdlp) {
	checkFfmpeg()

	const { setClient: setBrowseClient } = await import("../browse/data.js")
	setBrowseClient(ytdlp)

	const { browse } = await import("../browse/browse.js")
	let { selection, resume } = await browse()

	while (true) {
		if (!selection) break

		let { url, info, streamUrl, meta, cleanup, playlist } = selection
		let playlistIdx = playlist ? playlist.index : -1

		while (true) {
			let exitReason
			try {
				if (streamUrl && meta) {
					const fps = meta.fps
					const { width, height } = computeDimensions(
						meta.width,
						meta.height,
						process.stdout.columns,
						process.stdout.rows,
					)
					const decoder = createDecoder(streamUrl, width, height, fps, { audio: true })
					const duration = meta.duration || info.duration || 0
					exitReason = await play(decoder, width, height, fps, {
						info,
						duration,
						playlist: playlist ? { videos: playlist.videos, index: playlistIdx } : null,
					})
					if (cleanup) cleanup()
				} else {
					exitReason = await playVideo(url, { info })
				}
			} catch (err) {
				console.warn(`Skipping video: ${err.message || "unavailable"}`)
				if (playlist && playlistIdx < playlist.videos.length - 1) {
					exitReason = "next"
				} else {
					exitReason = "back"
				}
			}

			if (exitReason === "quit") return
			if (exitReason === "back") break

			if (playlist) {
				let nextIdx = playlistIdx
				if (exitReason === "next" || exitReason === "done") nextIdx++
				else if (exitReason === "prev") nextIdx--

				if (nextIdx < 0 || nextIdx >= playlist.videos.length) break

				playlistIdx = nextIdx
				const nextVideo = playlist.videos[playlistIdx]
				url = `https://www.youtube.com/watch?v=${nextVideo.id}`
				info = {
					title: nextVideo.title,
					channel: nextVideo.channel,
					duration: Number(nextVideo.duration) || 0,
					videoUrl: url,
				}

				showLoading()
				const { startSpinner, drawTitleBar } = await import("../tui/screen.js")
				drawTitleBar("PixelTube > Loading next...")
				const spinner = startSpinner(`Preparing "${nextVideo.title}"`)

				try {
					const resolved = await resolveInput(url, { onStatus: (msg) => spinner.update(msg) })
					streamUrl = resolved.streamUrl
					meta = resolved.meta || (await probe(streamUrl))
					if (!info.channel && meta.channel) info.channel = meta.channel
					cleanup = resolved.cleanup
					spinner.stop()
					hideLoading()
				} catch (err) {
					spinner.stop()
					hideLoading()
					console.warn(`Skipping video: ${err.message || "unavailable"}`)
					if (nextIdx < playlist.videos.length - 1) {
						playlistIdx++
						continue
					}
					break
				}
				continue
			}

			break
		}

		selection = await resume()
	}
}

export async function cmdDefaultBrowse(ytdlp, cookieArgs) {
	checkFfmpeg()
	const { isLoggedIn } = await import("../login.js")

	showLoading()
	const { startSpinner, drawTitleBar } = await import("../tui/screen.js")
	drawTitleBar("PixelTube")
	const spinner = startSpinner("Checking authentication")

	const loggedIn = await isLoggedIn(ytdlp)
	spinner.stop()
	hideLoading()

	if (!loggedIn) {
		const { verifyLogin } = await import("../login.js")
		await verifyLogin(ytdlp, cookieArgs)
	}

	await cmdBrowse(ytdlp)
}

export async function cmdPlayUrl(input, options) {
	checkFfmpeg()

	const isPlaylistUrl = input.includes("playlist?list=") || input.includes("&list=")

	if (isPlaylistUrl) {
		showLoading()
		const { startSpinner, drawTitleBar } = await import("../tui/screen.js")
		const { fetchPlaylistByUrl } = await import("../browse/data.js")
		drawTitleBar("PixelTube > Loading playlist...")
		const spinner = startSpinner("Fetching playlist")

		try {
			const videos = await fetchPlaylistByUrl(input)
			spinner.stop()
			hideLoading()

			if (videos.length === 0) {
				console.error("No videos found in playlist.")
				return
			}

			let playlistIdx = 0
			while (playlistIdx < videos.length) {
				const video = videos[playlistIdx]
				const url = `https://www.youtube.com/watch?v=${video.id}`
				const info = {
					title: video.title,
					channel: video.channel,
					duration: Number(video.duration) || 0,
					videoUrl: url,
				}

				let exitReason
				try {
					exitReason = await playVideo(url, {
						info,
						fps: options.fps,
						width: options.width,
						download: options.download,
						audio: options.audio,
						playlist: { videos, index: playlistIdx },
					})
				} catch (err) {
					console.warn(`Skipping video: ${err.message || "unavailable"}`)
					playlistIdx++
					continue
				}

				if (exitReason === "quit" || exitReason === "back") break
				if (exitReason === "next" || exitReason === "done") playlistIdx++
				else if (exitReason === "prev") playlistIdx = Math.max(0, playlistIdx - 1)
				else break
			}
		} catch (err) {
			spinner.stop()
			hideLoading()
			console.error("Failed to load playlist:", err.message)
		}
		return
	}

	await playVideo(input, {
		fps: options.fps,
		width: options.width,
		download: options.download,
		audio: options.audio,
	})
}

export async function cmdPlayFile(input, options) {
	checkFfmpeg()
	await playVideo(input, {
		fps: options.fps,
		width: options.width,
		download: options.download,
		audio: options.audio,
	})
}
