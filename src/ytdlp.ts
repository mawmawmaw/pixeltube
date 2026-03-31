// yt-dlp client factory — centralizes cookie args and process spawning

import { execFile, spawn } from "node:child_process"
import type { SpawnOptions } from "node:child_process"
import type { YtDlpClient } from "./types.js"

const MAX_BUFFER: number = 2 * 1024 * 1024

export function createClient({
	cookieArgs = ["--cookies-from-browser", "chrome"],
}: {
	cookieArgs?: string[]
} = {}): YtDlpClient {
	function run(args: string[], timeout: number = 60000): Promise<string> {
		return new Promise((resolve, reject) => {
			execFile(
				"yt-dlp",
				[...cookieArgs, "--no-warnings", ...args],
				{ timeout, maxBuffer: MAX_BUFFER },
				(err, stdout) => {
					if (err) return reject(err)
					resolve(stdout.trim())
				},
			)
		})
	}

	function spawnProcess(args: string[], options: SpawnOptions = {}) {
		return spawn("yt-dlp", [...cookieArgs, "--no-warnings", ...args], options)
	}

	return { run, spawn: spawnProcess, cookieArgs }
}
