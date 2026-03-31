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

async function ytDlpMeta(url: string): Promise<VideoMeta> {
	try {
		const stdout = await client.run(
			[
				"--print",
				"%(width)s",
				"--print",
				"%(height)s",
				"--print",
				"%(fps)s",
				"--print",
				"%(duration)s",
				"--print",
				"%(channel)s",
				"-f",
				"b[height<=720]/bv*[height<=720]+ba/b/bv*+ba",
				url,
			],
			30000,
		)
		const lines = stdout.split("\n").filter(Boolean)
		if (lines.length < 4) throw new Error("yt-dlp returned unexpected output")
		const ch = lines[4] || ""
		return {
			width: Number(lines[0]) || 1280,
			height: Number(lines[1]) || 720,
			fps: Number(lines[2]) || 24,
			duration: Number(lines[3]) || 0,
			channel: ch && ch !== "NA" ? ch : "",
		}
	} catch (err) {
		throw new Error(`yt-dlp failed: ${(err as Error).message}`)
	}
}

async function ytDlpStreamUrl(url: string): Promise<string> {
	try {
		const stdout = await client.run(["-f", "b[height<=720]/bv*[height<=720]+ba/b/bv*+ba", "-g", url], 30000)
		const urls = stdout.split("\n").filter(Boolean)
		if (urls.length === 0) throw new Error("yt-dlp returned no URLs")
		return urls[0]
	} catch (err) {
		throw new Error(`yt-dlp failed: ${(err as Error).message}`)
	}
}

function ytDlpDownload(url: string): Promise<{ tempPath: string; tempDir: string }> {
	const tempDir = mkdtempSync(join(tmpdir(), `pixeltube-${process.pid}-`))
	const tempPath = join(tempDir, "video.mp4")
	return new Promise((resolve, reject) => {
		const proc = client.spawn(
			["-f", "b[height<=720]/bv*[height<=720]+ba/b/bv*+ba", "--remux-video", "mp4", "-o", tempPath, url],
			{ stdio: ["ignore", "pipe", "pipe"] },
		)

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
	const meta = await ytDlpMeta(input)

	if (download) {
		log(`Downloading (${meta.width}x${meta.height}, ${Math.round(meta.duration)}s)...`)
		const { tempPath, tempDir } = await ytDlpDownload(input)
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

	log("Resolving stream...")
	const streamUrl = await ytDlpStreamUrl(input)
	return { streamUrl, isRemote: true, meta, cleanup: null }
}
