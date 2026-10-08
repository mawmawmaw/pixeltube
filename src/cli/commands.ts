// Command handlers for play, browse, login, and playlist URLs

import type { YtDlpClient, VideoMeta, VideoInfo, ExitReason, PlayVideoOptions } from "../types.js"
import { execFileSync } from "node:child_process"
import { resolveInput } from "../resolve.js"
import { probe } from "../probe.js"
import { computeDimensions, createDecoder } from "../decoder.js"
import { play } from "../player.js"
import { enterAltScreen, exitAltScreen, hideCursor, clearScreen } from "../tui/terminal.js"

function ffmpegInstallHint(): string {
	if (process.platform === "darwin") return "brew install ffmpeg"
	if (process.platform === "win32") return "winget install ffmpeg"
	return "your package manager (e.g. apt/pacman/dnf install ffmpeg) — see https://ffmpeg.org/download.html"
}

function checkFfmpeg(): void {
	try {
		execFileSync("ffmpeg", ["-version"], { stdio: "ignore" })
	} catch {
		console.error(`ffmpeg not found. Install it with ${ffmpegInstallHint()}.`)
		process.exit(1)
	}
	try {
		execFileSync("ffplay", ["-version"], { stdio: "ignore" })
	} catch {
		console.warn("Warning: ffplay not found. Audio playback will be unavailable.")
	}
}

function ytDlpInstallHint(): string {
	if (process.platform === "darwin") return "brew install yt-dlp"
	if (process.platform === "win32") return "winget install yt-dlp"
	return "pipx install yt-dlp (distro packages are often too old for YouTube) — see https://github.com/yt-dlp/yt-dlp#installation"
}

// YouTube features (browse, search, URLs, login) shell out to yt-dlp; local
// files only need ffmpeg, so this is checked per command rather than globally.
let ytDlpChecked = false

function checkYtDlp(): void {
	if (ytDlpChecked) return
	try {
		execFileSync("yt-dlp", ["--version"], { stdio: "ignore" })
		ytDlpChecked = true
	} catch {
		console.error(`yt-dlp not found. Install it with ${ytDlpInstallHint()}.`)
		process.exit(1)
	}
}

function errorHint(message: string): string {
	if (/403|forbidden/i.test(message)) {
		return "YouTube rejected the stream — yt-dlp is likely outdated. Update it (brew upgrade yt-dlp / yt-dlp -U)."
	}
	return ""
}

// Shows why a video could not play and waits for a key. Resolves true if the
// user wants to keep going (next video), false to stop (Esc / q / Ctrl-C).
async function showPlaybackError(title: string | undefined, err: unknown): Promise<boolean> {
	const message = (err as Error)?.message || "unavailable"
	const { drawTitleBar, drawStatusBar } = await import("../tui/screen.js")
	const { theme } = await import("../tui/theme.js")
	const { moveTo, cols, rows, onKey } = await import("../tui/terminal.js")
	const { truncate } = await import("../tui/width.js")
	showLoading()
	drawTitleBar("PixelTube > Playback failed")
	const w = cols()
	const lines = [`Could not play${title ? ` "${title}"` : ""}`, message, errorHint(message)].filter(Boolean)
	const top = Math.max(2, Math.floor(rows() / 2) - 1)
	lines.forEach((line, i) => {
		moveTo(top + i, 3)
		process.stdout.write(`${i === 0 ? theme.bold : theme.dim}${truncate(line, w - 4)}${theme.reset}`)
	})
	drawStatusBar("any key: continue · esc/q: back")
	const wasRaw = process.stdin.isRaw
	if (process.stdin.isTTY) process.stdin.setRawMode(true)
	process.stdin.resume()
	process.stdin.setEncoding("utf8")
	const proceed = await new Promise<boolean>((resolve) => {
		const off = onKey((key) => {
			off()
			resolve(!(key === "escape" || key === "q" || key === "ctrl-c" || key === "left"))
		})
	})
	if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw)
	hideLoading()
	return proceed
}

function showLoading(): void {
	enterAltScreen()
	hideCursor()
	clearScreen()
}

function hideLoading(): void {
	exitAltScreen()
}

async function playVideo(url: string, opts: PlayVideoOptions = {}): Promise<ExitReason> {
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
		onStatus: (msg: string) => spinner.update(msg),
	})
	const meta: VideoMeta = remoteMeta || (await probe(streamUrl))
	spinner.stop()
	hideLoading()

	const fps = opts.fps || meta.fps
	const termCols = opts.width || process.stdout.columns
	const { width, height } = computeDimensions(meta.width, meta.height, termCols, process.stdout.rows)

	const audio = opts.audio !== false
	const decoder = createDecoder(streamUrl, width, height, fps, { audio })
	const info: VideoInfo = opts.info || {}
	if (!info.channel && meta.channel) info.channel = meta.channel
	const duration = meta.duration || info.duration || 0
	const playlist = opts.playlist || null
	try {
		return await play(decoder, width, height, fps, { info, duration, playlist })
	} finally {
		if (cleanup) cleanup()
	}
}

export async function cmdLogin(ytdlp: YtDlpClient, cookieArgs: string[]): Promise<void> {
	checkYtDlp()
	const { verifyLogin } = await import("../login.js")
	const ok = await verifyLogin(ytdlp, cookieArgs)
	if (!ok) process.exit(1)
	console.log("\nLaunching browse...\n")
	await cmdBrowse(ytdlp, { loggedIn: true })
}

export async function cmdBrowse(ytdlp: YtDlpClient, opts: { loggedIn?: boolean } = {}): Promise<void> {
	checkFfmpeg()
	checkYtDlp()

	const { setClient: setBrowseClient } = await import("../browse/data.js")
	setBrowseClient(ytdlp)

	const { browse } = await import("../browse/browse.js")
	let { selection, resume } = await browse({ loggedIn: opts.loggedIn })

	while (true) {
		if (!selection) break

		let { url, info, streamUrl, meta, cleanup, playlist } = selection
		let playlistIdx = playlist ? playlist.index : -1

		while (true) {
			let exitReason: ExitReason
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
				if (cleanup) cleanup()
				const proceed = await showPlaybackError(info.title, err)
				exitReason = proceed && playlist && playlistIdx < playlist.videos.length - 1 ? "next" : "back"
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
					const resolved = await resolveInput(url, { onStatus: (msg: string) => spinner.update(msg) })
					streamUrl = resolved.streamUrl
					meta = resolved.meta || (await probe(streamUrl))
					if (!info.channel && meta.channel) info.channel = meta.channel
					cleanup = resolved.cleanup
					spinner.stop()
					hideLoading()
				} catch (err) {
					spinner.stop()
					hideLoading()
					if (!(await showPlaybackError(nextVideo.title, err))) break
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

export async function cmdDefaultBrowse(ytdlp: YtDlpClient, cookieArgs: string[]): Promise<void> {
	checkFfmpeg()
	checkYtDlp()
	const { isLoggedIn } = await import("../login.js")

	showLoading()
	const { startSpinner, drawTitleBar } = await import("../tui/screen.js")
	drawTitleBar("PixelTube")
	const spinner = startSpinner("Checking authentication")

	const loggedIn = await isLoggedIn(ytdlp)
	spinner.stop()
	hideLoading()

	if (!loggedIn && cookieArgs.length > 0) {
		console.warn("Could not access cookies — continuing in search-only mode.")
		console.warn("Run `pixeltube login` for diagnostic details.\n")
	}

	await cmdBrowse(ytdlp, { loggedIn })
}

export async function cmdPlayUrl(input: string, options: PlayVideoOptions): Promise<void> {
	checkFfmpeg()
	checkYtDlp()

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
				const info: VideoInfo = {
					title: video.title,
					channel: video.channel,
					duration: Number(video.duration) || 0,
					videoUrl: url,
				}

				let exitReason: ExitReason
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
					if (!(await showPlaybackError(video.title, err))) break
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
			console.error("Failed to load playlist:", (err as Error).message)
		}
		return
	}

	await playSingle(input, options)
}

async function playSingle(input: string, options: PlayVideoOptions): Promise<void> {
	try {
		await playVideo(input, {
			fps: options.fps,
			width: options.width,
			download: options.download,
			audio: options.audio,
		})
	} catch (err) {
		const message = (err as Error)?.message || "unavailable"
		console.error(`Playback failed: ${message}`)
		const hint = errorHint(message)
		if (hint) console.error(hint)
		process.exitCode = 1
	}
}

export async function cmdPlayFile(input: string, options: PlayVideoOptions): Promise<void> {
	checkFfmpeg()
	await playSingle(input, options)
}
