// Subtitle download via yt-dlp (async, non-blocking)

import { parseSrt } from "../utils/srt.js"
import { execFile } from "node:child_process"
import { readFile, rm, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export async function downloadSubs(videoUrl) {
	const tmpDir = await mkdtemp(join(tmpdir(), `pixeltube-sub-${process.pid}-`))
	const tmpPath = join(tmpDir, "sub")
	return new Promise((resolve) => {
		execFile(
			"yt-dlp",
			[
				"--no-warnings",
				"--write-auto-subs",
				"--sub-langs",
				"en",
				"--sub-format",
				"srt",
				"--skip-download",
				"-o",
				tmpPath,
				videoUrl,
			],
			{ timeout: 15000 },
			async (err) => {
				if (err) return resolve([])
				try {
					const srtPath = `${tmpPath}.en.srt`
					const content = await readFile(srtPath, "utf8")
					rm(tmpDir, { recursive: true, force: true }).catch(() => {})
					resolve(parseSrt(content))
				} catch {
					resolve([])
				}
			},
		)
	})
}
