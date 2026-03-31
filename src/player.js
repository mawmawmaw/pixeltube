// Video playback loop — frame timing, controls, subtitle overlay

import { renderFrame, resetRenderer } from "./renderer.js"
import { createDecoder, computeDimensions } from "./decoder.js"
import { enterAltScreen, exitAltScreen, hideCursor, showCursor, clearScreen, resetStyle } from "./tui/terminal.js"
import { findSub } from "./utils/srt.js"
import { drawChrome } from "./player/chrome.js"
import { downloadSubs } from "./player/subs.js"

function setupTerminal() {
	enterAltScreen()
	hideCursor()
	clearScreen()
}

function restoreTerminal() {
	resetStyle()
	showCursor()
	exitAltScreen()
}

// Returns: 'done', 'back', 'quit', 'next', 'prev'
export async function play(decoder, width, height, fps, { info = {}, duration = 0, playlist = null } = {}) {
	setupTerminal()
	resetRenderer()

	const wasRaw = process.stdin.isRaw
	process.stdin.setRawMode(true)
	process.stdin.resume()
	process.stdin.setEncoding("utf8")

	let exitReason = "done"
	let pendingAction = null
	let isPaused = false
	let isMuted = false
	let showSubs = false

	const keyHandler = (data) => {
		if (data === "\x1b" || data === "\x1b[D") pendingAction = "back"
		else if (data === "\x03" || data === "q") pendingAction = "quit"
		else if (data === " ") pendingAction = "toggle-pause"
		else if (data === "r") pendingAction = "rewind"
		else if (data === "f") pendingAction = "forward"
		else if (data === "n") pendingAction = "next"
		else if (data === "p") pendingAction = "prev"
		else if (data === "m") pendingAction = "toggle-mute"
		else if (data === "s") pendingAction = "toggle-subs"
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

	let subs = []
	let currentSub = null
	if (info.videoUrl) {
		downloadSubs(info.videoUrl)
			.then((result) => {
				subs = result
			})
			.catch(() => {})
	}

	function updateChrome() {
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
			await new Promise((r) => setTimeout(r, 50))
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
			await new Promise((r) => process.stdout.once("drain", r))
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
			await new Promise((r) => setTimeout(r, sleepMs))
		}
	}

	cleanup()
	return exitReason
}
