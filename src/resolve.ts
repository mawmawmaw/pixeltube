// URL resolution — resolves YouTube URLs to direct stream URLs via yt-dlp

import { tmpdir } from "node:os"
import { join } from "node:path"
import { mkdtempSync, rmSync } from "node:fs"
import { createClient } from "./ytdlp.js"
import type { YtDlpClient, VideoMeta, ResolveResult, ResolveOptions } from "./types.js"

function isURL(input: string): boolean {
	return /^https?:\/\//.test(input)
}

let client: YtDlpClient = createClient()

export function setClient(c: YtDlpClient): void {
	client = c
}

const FORMAT = "b[height<=720]/bv*[height<=720]+ba/b/bv*+ba"

interface StreamInfo {
	meta: VideoMeta
	streamUrl: string
	/** Unix seconds before which YouTube rejects the stream URL with 403 (0 = no wait). */
	availableAt: number
}

interface YtDlpFormat {
	url?: string
	available_at?: number
}

interface YtDlpInfo extends YtDlpFormat {
	width?: number
	height?: number
	fps?: number
	duration?: number
	channel?: string
	requested_formats?: YtDlpFormat[]
}

// One `-j` call gives metadata, the stream URL and `available_at` together
// (previously two separate yt-dlp runs for --print and -g).
async function ytDlpInfo(url: string, auth: boolean): Promise<StreamInfo> {
	let info: YtDlpInfo
	try {
		info = JSON.parse(await client.run(["-f", FORMAT, "-j", url], { timeout: 30000, auth }))
	} catch (err) {
		throw new Error(`yt-dlp failed: ${(err as Error).message}`)
	}
	// Same choice as `-g`'s first line: the progressive URL, or the video half of a merge.
	const formats = info.requested_formats?.length ? info.requested_formats : [info]
	const streamUrl = formats[0].url
	if (!streamUrl) throw new Error("yt-dlp failed: no stream URL in output")
	return {
		meta: {
			width: Number(info.width) || 1280,
			height: Number(info.height) || 720,
			fps: Number(info.fps) || 24,
			duration: Number(info.duration) || 0,
			channel: info.channel || "",
		},
		streamUrl,
		availableAt: Math.max(0, ...formats.map((f) => Number(f.available_at) || 0)),
	}
}

// YouTube now withholds the stream until a pre-roll ad would have played (or
// become skippable): requesting it earlier returns 403. yt-dlp's own downloader
// sleeps until `available_at`; we must do the same before ffmpeg opens the URL.
const AVAILABILITY_MARGIN_MS = 500

async function waitUntilAvailable(availableAt: number, log: (msg: string) => void): Promise<void> {
	const until = availableAt * 1000 + AVAILABILITY_MARGIN_MS
	while (Date.now() < until) {
		log(`Waiting ${Math.ceil((until - Date.now()) / 1000)}s for YouTube to release the stream...`)
		await new Promise<void>((r) => setTimeout(r, Math.min(1000, until - Date.now())))
	}
}

// Resolving signed in matters: anonymous sessions get a pre-roll ad, so YouTube
// holds the stream back (see waitUntilAvailable), while Premium accounts get none.
// Cookie problems must never block a public video, so fall back to anonymous.
async function resolveStream(url: string): Promise<StreamInfo & { auth: boolean }> {
	if (client.cookieArgs.length > 0) {
		try {
			return { ...(await ytDlpInfo(url, true)), auth: true }
		} catch {}
	}
	return { ...(await ytDlpInfo(url, false)), auth: false }
}

function ytDlpDownload(url: string, auth: boolean): Promise<{ tempPath: string; tempDir: string }> {
	const tempDir = mkdtempSync(join(tmpdir(), `pixeltube-${process.pid}-`))
	const tempPath = join(tempDir, "video.mp4")
	return new Promise((resolve, reject) => {
		const proc = client.spawn(["-f", FORMAT, "--remux-video", "mp4", "-o", tempPath, url], {
			auth,
			spawn: { stdio: ["ignore", "pipe", "pipe"] },
		})

		proc.stderr!.on("data", (chunk: Buffer) => {
			const line = chunk.toString().trim()
			if (line) process.stderr.write(`\r\x1b[K${line}`)
		})
		proc.stdout!.on("data", (chunk: Buffer) => {
			const line = chunk.toString().trim()
			if (line) process.stderr.write(`\r\x1b[K${line}`)
		})

		proc.on("close", (code: number | null) => {
			process.stderr.write("\r\x1b[K")
			if (code !== 0) return reject(new Error(`yt-dlp download failed (exit ${code})`))
			resolve({ tempPath, tempDir })
		})
	})
}

export async function resolveInput(
	input: string,
	{ download = false, onStatus }: ResolveOptions = {},
): Promise<ResolveResult> {
	const log = onStatus || ((msg: string) => console.log(msg))

	if (!isURL(input)) {
		return { streamUrl: input, isRemote: false, meta: null, cleanup: null }
	}

	log("Fetching video info...")
	const { meta, streamUrl, availableAt, auth } = await resolveStream(input)

	if (download) {
		// yt-dlp's downloader honours available_at itself.
		log(`Downloading (${meta.width}x${meta.height}, ${Math.round(meta.duration)}s)...`)
		const { tempPath, tempDir } = await ytDlpDownload(input, auth)
		return {
			streamUrl: tempPath,
			isRemote: true,
			meta,
			cleanup: () => {
				try {
					rmSync(tempDir, { recursive: true, force: true })
				} catch {}
			},
		}
	}

	await waitUntilAvailable(availableAt, log)
	return { streamUrl, isRemote: true, meta, cleanup: null }
}
