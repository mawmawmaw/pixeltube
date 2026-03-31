// Player UI chrome — borders, progress bar, info panel (compact + full modes)

import type { VideoInfo } from "../types.js"
import { theme } from "../tui/theme.js"
import { syncStart, syncEnd } from "../tui/terminal.js"
import { formatTime } from "../utils/time.js"
import { sanitize } from "../utils/sanitize.js"

const DIM = theme.dim
const BOLD = theme.bold
const RESET = theme.reset

const TL = "\u256D"
const TR = "\u256E"
const BL = "\u2570"
const BR = "\u256F"
const H = "\u2500"
const V = "\u2502"

export function drawProgressBar(current: number, total: number, barWidth: number): string {
	if (total <= 0) return H.repeat(barWidth)
	const filled = Math.round((current / total) * barWidth)
	const empty = barWidth - filled
	return `${theme.progressFill}${"\u2501".repeat(Math.max(0, filled))}${RESET}${theme.progressEmpty}${"\u2500".repeat(Math.max(0, empty))}${RESET}`
}

export function drawChrome(
	videoRows: number,
	videoWidth: number,
	info: VideoInfo,
	currentTime: number,
	duration: number,
	isPaused: boolean,
	nextTitle: string | null,
	isMuted: boolean,
	subtitle: string | null,
	compact: boolean,
): void {
	const termCols = process.stdout.columns || 80
	const termRows = process.stdout.rows || 24

	syncStart()

	if (compact) {
		drawCompact(videoRows, termCols, termRows, info, currentTime, duration, isPaused, isMuted, nextTitle, subtitle)
	} else {
		drawFull(
			videoRows,
			videoWidth,
			termCols,
			termRows,
			info,
			currentTime,
			duration,
			isPaused,
			isMuted,
			nextTitle,
			subtitle,
		)
	}

	syncEnd()
}

function drawCompact(
	videoRows: number,
	termCols: number,
	termRows: number,
	info: VideoInfo,
	currentTime: number,
	duration: number,
	isPaused: boolean,
	isMuted: boolean,
	nextTitle: string | null,
	subtitle: string | null,
): void {
	const infoRow = videoRows + 1

	process.stdout.write(`\x1b[${infoRow};1H\x1b[2K`)
	process.stdout.write(drawProgressBar(currentTime, duration, termCols))

	const title = sanitize(info.title || "")
	const durStr = duration > 0 ? ` / ${formatTime(duration)}` : ""
	const timeStr = `${formatTime(currentTime)}${durStr}`
	const statusTags: string[] = []
	if (isPaused) statusTags.push("II")
	if (isMuted) statusTags.push("M")
	const statusText = statusTags.join(" ")
	const rightText = statusText ? `${statusText} ${timeStr}` : timeStr
	const maxTitle = Math.max(5, termCols - rightText.length - 3)
	const truncTitle = title.length > maxTitle ? title.slice(0, maxTitle - 3) + "..." : title

	process.stdout.write(`\x1b[${infoRow + 1};1H\x1b[2K`)
	const gap = Math.max(1, termCols - truncTitle.length - rightText.length - 2)
	process.stdout.write(` ${BOLD}${truncTitle}${RESET}${" ".repeat(gap)}${DIM}${rightText}${RESET}`)

	if (subtitle) {
		const maxSub = termCols - 2
		const truncSub = subtitle.length > maxSub ? subtitle.slice(0, maxSub - 3) + "..." : subtitle
		const subPad = Math.floor((termCols - truncSub.length) / 2)
		process.stdout.write(`\x1b[${videoRows};1H`)
		process.stdout.write(`${theme.subtitleBg}${theme.subtitleFg}`)
		process.stdout.write(
			" ".repeat(Math.max(0, subPad)) + truncSub + " ".repeat(Math.max(0, termCols - subPad - truncSub.length)),
		)
		process.stdout.write(RESET)
	}

	const ctrl = nextTitle
		? " spc:pause m:mute s:sub r/f:seek n/p:trk esc:back"
		: " spc:pause m:mute s:sub r/f:seek esc:back"
	process.stdout.write(`\x1b[${termRows};1H\x1b[2K${DIM}${ctrl.slice(0, termCols - 1)}${RESET}`)
}

function drawFull(
	videoRows: number,
	videoWidth: number,
	termCols: number,
	termRows: number,
	info: VideoInfo,
	currentTime: number,
	duration: number,
	isPaused: boolean,
	isMuted: boolean,
	nextTitle: string | null,
	subtitle: string | null,
): void {
	const boxWidth = videoWidth + 2
	const offsetX = Math.max(1, Math.floor((termCols - boxWidth) / 2) + 1)
	const offsetY = 1

	process.stdout.write(`\x1b[${offsetY};${offsetX}H`)
	process.stdout.write(`${DIM}${TL}${H.repeat(videoWidth)}${TR}${RESET}`)

	for (let r = 0; r < videoRows; r++) {
		const row = offsetY + 1 + r
		process.stdout.write(`\x1b[${row};${offsetX}H${DIM}${V}${RESET}`)
		process.stdout.write(`\x1b[${row};${offsetX + videoWidth + 1}H${DIM}${V}${RESET}`)
	}

	const botBorderRow = offsetY + 1 + videoRows
	process.stdout.write(`\x1b[${botBorderRow};${offsetX}H${DIM}${V}${RESET}`)
	process.stdout.write(drawProgressBar(currentTime, duration, videoWidth))
	process.stdout.write(`${DIM}${V}${RESET}`)

	const infoRow = botBorderRow + 1
	const title = sanitize(info.title || "")
	const maxTitle = Math.max(10, videoWidth - 2)
	const truncTitle = title.length > maxTitle ? title.slice(0, maxTitle - 3) + "..." : title

	process.stdout.write(`\x1b[${infoRow};${offsetX}H${DIM}${V}${RESET}`)
	process.stdout.write(` ${BOLD}${truncTitle}${RESET}`)
	process.stdout.write(" ".repeat(Math.max(0, videoWidth - truncTitle.length - 1)))
	process.stdout.write(`${DIM}${V}${RESET}`)

	const durStr = duration > 0 ? ` / ${formatTime(duration)}` : ""
	const timeStr = `${formatTime(currentTime)}${durStr}`
	const statusTags: string[] = []
	if (isPaused) statusTags.push("PAUSED")
	if (isMuted) statusTags.push("MUTED")
	const statusText = statusTags.length > 0 ? statusTags.join(" ") + " " : ""
	const pauseTag = statusText ? `${theme.statusTag} ${statusText}${RESET}` : ""
	const pauseVisLen = statusText ? statusText.length + 1 : 0
	const channel = sanitize(info.channel || "")
	const chDisplay = channel ? `${DIM}${channel}${RESET}` : ""

	process.stdout.write(`\x1b[${infoRow + 1};${offsetX}H${DIM}${V}${RESET}`)
	process.stdout.write(` ${chDisplay}`)
	const rightSide = `${pauseTag}${timeStr}`
	const rightVisLen = pauseVisLen + timeStr.length
	const gap = Math.max(1, videoWidth - channel.length - rightVisLen - 2)
	process.stdout.write(" ".repeat(gap))
	process.stdout.write(rightSide + " ")
	process.stdout.write(`${DIM}${V}${RESET}`)

	if (nextTitle) {
		const nextLabel = `Next: ${nextTitle}`
		const maxNext = videoWidth - 2
		const truncNext = nextLabel.length > maxNext ? nextLabel.slice(0, maxNext - 3) + "..." : nextLabel
		process.stdout.write(`\x1b[${infoRow + 2};${offsetX}H${DIM}${V} ${truncNext}${RESET}`)
		process.stdout.write(" ".repeat(Math.max(0, videoWidth - truncNext.length - 1)))
		process.stdout.write(`${DIM}${V}${RESET}`)
	} else {
		process.stdout.write(`\x1b[${infoRow + 2};${offsetX}H${DIM}${V}${RESET}`)
		process.stdout.write(" ".repeat(videoWidth))
		process.stdout.write(`${DIM}${V}${RESET}`)
	}

	if (subtitle) {
		const maxSub = videoWidth - 4
		const truncSub = subtitle.length > maxSub ? subtitle.slice(0, maxSub - 3) + "..." : subtitle
		const subPad = Math.floor((videoWidth - truncSub.length) / 2)
		const subRow = offsetY + videoRows
		process.stdout.write(`\x1b[${subRow};${offsetX + 1}H`)
		process.stdout.write(`${theme.subtitleBg}${theme.subtitleFg}`)
		process.stdout.write(
			" ".repeat(Math.max(0, subPad)) + truncSub + " ".repeat(Math.max(0, videoWidth - subPad - truncSub.length)),
		)
		process.stdout.write(RESET)
	}

	process.stdout.write(`\x1b[${infoRow + 3};${offsetX}H`)
	process.stdout.write(`${DIM}${BL}${H.repeat(videoWidth)}${BR}${RESET}`)

	const controlsText = nextTitle
		? " space:pause  m:mute  s:subs  r/f:seek  n:next  p:prev  esc:back"
		: " space:pause  m:mute  s:subs  r/f:seek  esc:back"
	process.stdout.write(`\x1b[${termRows};1H\x1b[2K${DIM}${controlsText.slice(0, termCols - 1)}${RESET}`)
}
