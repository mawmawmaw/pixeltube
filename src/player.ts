// Video playback loop — frame timing, controls, subtitle overlay

import type { Decoder, ExitReason, PlayOptions, Subtitle } from "./types.js"
import { renderFrame, resetRenderer } from "./renderer.js"
import { createDecoder, computeDimensions } from "./decoder.js"
import { enterAltScreen, exitAltScreen, hideCursor, showCursor, clearScreen, resetStyle } from "./tui/terminal.js"
import { findSub } from "./utils/srt.js"
import { drawChrome } from "./player/chrome.js"
import { downloadSubs } from "./player/subs.js"

function setupTerminal(): void {
	enterAltScreen()
	hideCursor()
	clearScreen()
}

function restoreTerminal(): void {
	resetStyle()
	showCursor()
	exitAltScreen()
}

export async function play(
	decoder: Decoder,
	width: number,
	height: number,
	fps: number,
	{ info = {}, duration = 0, playlist = null }: PlayOptions = {},
): Promise<ExitReason> {
	setupTerminal()
	resetRenderer()

	const wasRaw = process.stdin.isRaw
	process.stdin.setRawMode(true)
	process.stdin.resume()
	process.stdin.setEncoding("utf8")

	let exitReason: ExitReason = "done"
	let pendingAction: string | null = null
	let isPaused = false
	let isMuted = false
	let showSubs = false

	const keyHandler = (data: string | Buffer) => {
		const str = String(data)
		if (str === "\x1b" || str === "\x1b[D") pendingAction = "back"
		else if (str === "\x03" || str === "q") pendingAction = "quit"
		else if (str === " ") pendingAction = "toggle-pause"
		else if (str === "r") pendingAction = "rewind"
		else if (str === "f") pendingAction = "forward"
		else if (str === "n") pendingAction = "next"
		else if (str === "p") pendingAction = "prev"
		else if (str === "m") pendingAction = "toggle-mute"
		else if (str === "s") pendingAction = "toggle-subs"
	}
	process.stdin.on("data", keyHandler)

	let needsResize = false
	const resizeHandler = () => {
		needsResize = true
	}
	process.stdout.on("resize", resizeHandler)

	const cleanup = () => {
		process.stdin.removeListener("data", keyHandler)
		process.stdout.removeListener("resize", resizeHandler)
		if (!wasRaw) {
			process.stdin.setRawMode(false)
			process.stdin.pause()
		}
		restoreTerminal()
		decoder.kill()
	}

	let termCols = process.stdout.columns || 80
	let termRows = process.stdout.rows || 24
	let compact = termCols < 60 || termRows < 18
	let videoRows = Math.ceil(height / 2)
	let boxWidth = width + 2
	let videoOffsetX = compact ? 1 : Math.max(1, Math.floor((termCols - boxWidth) / 2) + 2)
	let videoOffsetY = compact ? 1 : 2

	const frameDuration = 1000 / fps
	let seekBase = 0
	let playbackStartedAt = Date.now()
	let currentTime = 0
	let isPausedAt = 0
	let nextFrameTime = Date.now()
	let framesSinceChrome = 0

	const nextTitle =
		playlist && playlist.index < playlist.videos.length - 1 ? playlist.videos[playlist.index + 1].title : null

	let subs: Subtitle[] = []
	let currentSub: string | null = null
	if (info.videoUrl) {
		downloadSubs(info.videoUrl)
			.then((result) => {
				subs = result
			})
			.catch(() => {})
	}

	function updateChrome(): void {
		drawChrome(
			videoRows,
			width,
			info,
			currentTime,
			duration,
			isPaused,
			nextTitle,
			isMuted,
			showSubs ? currentSub : null,
			compact,
		)
	}

	updateChrome()

	while (true) {
		if (needsResize) {
			needsResize = false
			if (!isPaused) {
				currentTime = seekBase + (Date.now() - playbackStartedAt) / 1000
				isPausedAt = currentTime
				isPaused = true
				decoder.killAudio()
				decoder.pauseStream()
				decoder.flushFrames()
			}
			termCols = process.stdout.columns || 80
			termRows = process.stdout.rows || 24
			compact = termCols < 60 || termRows < 18
			const { width: nw, height: nh } = computeDimensions(decoder.width, decoder.height, termCols, termRows)
			decoder.kill()
			resetRenderer()
			decoder = createDecoder(decoder.filePath, nw, nh, fps, {
				audio: decoder.audio,
				startTime: currentTime,
				startPaused: true,
			})
			width = nw
			height = nh
			videoRows = Math.ceil(nh / 2)
			boxWidth = nw + 2
			videoOffsetX = compact ? 1 : Math.max(1, Math.floor((termCols - boxWidth) / 2) + 2)
			videoOffsetY = compact ? 1 : 2
			seekBase = currentTime
			nextFrameTime = Date.now()
			clearScreen()
			updateChrome()
			continue
		}

		if (pendingAction) {
			const action = pendingAction
			pendingAction = null

			if (action === "back" || action === "quit" || action === "next" || action === "prev") {
				exitReason = action
				break
			}

			if (action === "toggle-pause") {
				isPaused = !isPaused
				if (isPaused) {
					currentTime = seekBase + (Date.now() - playbackStartedAt) / 1000
					isPausedAt = currentTime
					decoder.killAudio()
					decoder.pauseStream()
					decoder.flushFrames()
				} else {
					currentTime = isPausedAt
					seekBase = currentTime
					decoder.flushFrames()
					decoder.resumeStream()
					if (!isMuted) decoder.respawnAudio(currentTime)
					playbackStartedAt = Date.now()
					nextFrameTime = Date.now()
				}
				updateChrome()
				continue
			}

			if (action === "toggle-mute") {
				isMuted = !isMuted
				if (isMuted) {
					decoder.killAudio()
				} else if (!isPaused) {
					decoder.respawnAudio(seekBase + (Date.now() - playbackStartedAt) / 1000)
				}
				updateChrome()
				continue
			}

			if (action === "toggle-subs") {
				showSubs = !showSubs
				if (!showSubs) resetRenderer()
				updateChrome()
				continue
			}

			if (action === "rewind" || action === "forward") {
				const seekDelta = action === "rewind" ? -10 : 10
				if (!isPaused) {
					currentTime = seekBase + (Date.now() - playbackStartedAt) / 1000
				}
				const seekTo = Math.max(0, currentTime + seekDelta)

				decoder.kill()
				resetRenderer()
				decoder = createDecoder(decoder.filePath, width, height, fps, {
					audio: decoder.audio,
					startTime: seekTo,
					startPaused: isPaused || isMuted,
				})
				if (!isMuted && !isPaused) decoder.respawnAudio(seekTo)
				seekBase = seekTo
				currentTime = seekTo
				isPausedAt = seekTo
				playbackStartedAt = Date.now()
				nextFrameTime = Date.now()

				clearScreen()
				updateChrome()
				continue
			}
		}

		if (isPaused) {
			await new Promise<void>((r) => setTimeout(r, 50))
			continue
		}

		await decoder.waitForFrame()
		if (decoder.done) break

		const now = Date.now()

		while (decoder.frames.length > 1 && nextFrameTime + frameDuration < now) {
			decoder.consumeFrame()
			nextFrameTime += frameDuration
		}
		if (nextFrameTime + frameDuration * 2 < now) {
			nextFrameTime = now
		}

		const frame = decoder.consumeFrame()
		if (!frame) break

		const subSkipRow = showSubs && currentSub ? videoRows - 1 : -1
		const rendered = renderFrame(frame, width, height, videoOffsetY, videoOffsetX, subSkipRow)

		const flushed = process.stdout.write(rendered)
		if (!flushed) {
			// stdout buffer full — wait for drain before continuing
			await new Promise<void>((r) => process.stdout.once("drain", r))
		}

		currentTime = seekBase + (Date.now() - playbackStartedAt) / 1000

		if (showSubs && subs.length > 0) {
			currentSub = findSub(subs, currentTime)
		}

		framesSinceChrome++
		if (framesSinceChrome >= Math.max(1, Math.round(fps / 2))) {
			updateChrome()
			framesSinceChrome = 0
		}

		nextFrameTime += frameDuration
		const sleepMs = nextFrameTime - Date.now()
		if (sleepMs > 0) {
			await new Promise<void>((r) => setTimeout(r, sleepMs))
		}
	}

	cleanup()
	return exitReason
}
