// FFmpeg video decoder with ring buffer, frame pooling, and audio management

import { spawn, type ChildProcess } from "node:child_process"
import type { Decoder, DecoderOptions } from "./types.js"

const MAX_QUEUED_FRAMES = 30
const RESUME_THRESHOLD = 10

export function computeDimensions(
	videoWidth: number,
	videoHeight: number,
	termCols: number,
	termRows: number,
): { width: number; height: number } {
	const compact = termCols < 60 || termRows < 18
	// Compact: progress + title + controls = 3. Full: top border + progress + title + time + next + bottom border + controls = 7
	const reserveRows = compact ? 3 : 7
	const targetW = compact ? termCols : termCols - 2
	const targetH = (termRows - reserveRows) * 2

	const videoAspect = videoWidth / videoHeight
	let w = targetW
	let h = Math.round(w / videoAspect)

	if (h > targetH) {
		h = targetH
		w = Math.round(h * videoAspect)
	}

	if (w > targetW) w = targetW
	if (h % 2 !== 0) h--
	if (w < 4) w = 4
	if (h < 2) h = 2

	return { width: w, height: h }
}

function buildInputArgs(filePath: string, startTime: number): string[] {
	const isRemote = /^https?:\/\//.test(filePath)
	const args: string[] = []
	if (startTime > 0) args.push("-ss", String(startTime))
	if (isRemote) {
		args.push(
			"-reconnect",
			"1",
			"-reconnect_streamed",
			"1",
			"-reconnect_delay_max",
			"5",
			"-headers",
			"Referer: https://www.youtube.com/\r\n",
		)
	}
	args.push("-i", filePath)
	return args
}

function spawnAudio(filePath: string, startTime: number): ChildProcess | null {
	const inputArgs = buildInputArgs(filePath, startTime)
	try {
		const proc = spawn("ffplay", [...inputArgs, "-nodisp", "-autoexit", "-vn", "-loglevel", "quiet"], {
			stdio: ["ignore", "ignore", "ignore"],
		})
		proc.on("error", () => {})
		return proc
	} catch {
		return null
	}
}

export function createDecoder(
	filePath: string,
	width: number,
	height: number,
	fps: number,
	{ audio = true, startTime = 0, startPaused = false }: DecoderOptions = {},
): Decoder {
	const frameSize = width * height * 3
	const inputArgs = buildInputArgs(filePath, startTime)

	let audioProc: ChildProcess | null = audio && !startPaused ? spawnAudio(filePath, startTime) : null

	const ffmpeg = spawn(
		"ffmpeg",
		[
			...inputArgs,
			"-f",
			"rawvideo",
			"-pix_fmt",
			"rgb24",
			"-s",
			`${width}x${height}`,
			"-r",
			String(fps),
			"-sws_flags",
			"neighbor",
			"-v",
			"quiet",
			"pipe:1",
		],
		{ stdio: ["ignore", "pipe", "pipe"] },
	)

	let stderrBuf = ""
	ffmpeg.stderr!.on("data", (chunk: Buffer) => {
		stderrBuf += chunk.toString()
	})

	const readBufSize = frameSize * 4
	let readBuf: Buffer = Buffer.allocUnsafe(readBufSize)
	let readOffset = 0 // start of unprocessed data
	let writeOffset = 0 // end of unprocessed data

	const ringCapacity = MAX_QUEUED_FRAMES + 10
	const bufferPool: Buffer[] = Array.from({ length: ringCapacity }, () => Buffer.allocUnsafe(frameSize))

	function acquireBuffer(): Buffer {
		return bufferPool[ringTail % ringCapacity]
	}

	const ring: (Buffer | null)[] = Array.from({ length: ringCapacity })
	let ringHead: number = 0
	let ringTail: number = 0
	let ringSize: number = 0

	const frames = {
		get length(): number {
			return ringSize
		},
	}

	function ringPush(item: Buffer): void {
		ring[ringTail] = item
		ringTail = (ringTail + 1) % ringCapacity
		ringSize++
	}

	function ringShift(): Buffer | undefined {
		if (ringSize === 0) return undefined
		const item = ring[ringHead]
		ring[ringHead] = null
		ringHead = (ringHead + 1) % ringCapacity
		ringSize--
		return item!
	}

	function ringClear(): void {
		ringHead = 0
		ringTail = 0
		ringSize = 0
	}

	let done: boolean = false
	let streamPaused: boolean = false
	let onFrame: (() => void) | null = null

	ffmpeg.stdout!.on("data", (chunk: Buffer) => {
		const available = readBuf.length - writeOffset
		if (chunk.length > available) {
			const dataLen = writeOffset - readOffset
			if (chunk.length <= readBuf.length - dataLen) {
				// Compact: shift data to start
				readBuf.copyWithin(0, readOffset, writeOffset)
				writeOffset = dataLen
				readOffset = 0
			} else {
				const newSize = Math.max(readBuf.length * 2, dataLen + chunk.length)
				const newBuf = Buffer.allocUnsafe(newSize)
				readBuf.copy(newBuf, 0, readOffset, writeOffset)
				readBuf = newBuf
				writeOffset = dataLen
				readOffset = 0
			}
		}

		chunk.copy(readBuf, writeOffset)
		writeOffset += chunk.length

		while (writeOffset - readOffset >= frameSize && ringSize < ringCapacity) {
			const frame = acquireBuffer()
			readBuf.copy(frame, 0, readOffset, readOffset + frameSize)
			readOffset += frameSize

			ringPush(frame)
			if (onFrame) {
				const cb = onFrame
				onFrame = null
				cb()
			}
		}

		if (readOffset > readBuf.length / 2) {
			const remaining = writeOffset - readOffset
			readBuf.copyWithin(0, readOffset, writeOffset)
			readOffset = 0
			writeOffset = remaining
		}

		if (ringSize >= MAX_QUEUED_FRAMES && !streamPaused) {
			ffmpeg.stdout!.pause()
			streamPaused = true
		}
	})

	ffmpeg.on("close", (code: number | null) => {
		if (code !== 0 && frames.length === 0) {
			process.stderr.write(`\x1b[0m\nffmpeg exited with code ${code}\n${stderrBuf}\n`)
		}
		done = true
		if (onFrame) {
			const cb = onFrame
			onFrame = null
			cb()
		}
	})

	return {
		filePath,
		width,
		height,
		fps,
		audio,
		frames,
		get done() {
			return done && frames.length === 0
		},
		waitForFrame() {
			if (frames.length > 0 || done) return Promise.resolve()
			return new Promise<void>((resolve) => {
				onFrame = resolve
			})
		},
		consumeFrame() {
			const frame = ringShift()
			if (streamPaused && ringSize <= RESUME_THRESHOLD) {
				ffmpeg.stdout!.resume()
				streamPaused = false
			}
			return frame
		},
		flushFrames() {
			ringClear()
			if (streamPaused) {
				ffmpeg.stdout!.resume()
				streamPaused = false
			}
		},
		pauseStream() {
			if (!streamPaused) {
				ffmpeg.stdout!.pause()
				streamPaused = true
			}
		},
		resumeStream() {
			if (streamPaused) {
				ffmpeg.stdout!.resume()
				streamPaused = false
			}
		},
		killAudio() {
			if (audioProc) {
				try {
					audioProc.kill("SIGTERM")
				} catch {}
				audioProc = null
			}
		},
		respawnAudio(atTime: number) {
			if (audioProc) {
				try {
					audioProc.kill("SIGTERM")
				} catch {}
				audioProc = null
			}
			if (!audio) return
			audioProc = spawnAudio(filePath, atTime)
		},
		kill() {
			ffmpeg.kill("SIGTERM")
			if (audioProc) {
				try {
					audioProc.kill("SIGTERM")
				} catch {}
			}
		},
	}
}
