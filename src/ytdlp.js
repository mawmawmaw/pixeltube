// yt-dlp client factory — centralizes cookie args and process spawning

import { execFile, spawn } from "node:child_process"

const MAX_BUFFER = 2 * 1024 * 1024

export function createClient({ cookieArgs = ["--cookies-from-browser", "chrome"] } = {}) {
	function run(args, timeout = 60000) {
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

	function spawnProcess(args, options = {}) {
		return spawn("yt-dlp", [...cookieArgs, "--no-warnings", ...args], options)
	}

	return { run, spawn: spawnProcess, cookieArgs }
}
