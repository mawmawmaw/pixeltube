// yt-dlp client factory — centralizes cookie args and process spawning.
// Cookies are only attached when a call opts in with `auth: true`, so public
// operations (search, public video resolve) cannot fail due to cookie problems.

import { spawn } from "node:child_process"
import type { SpawnOptions } from "node:child_process"
import type { YtDlpClient, YtDlpRunOptions, YtDlpSpawnOptions, YtDlpRunResult } from "./types.js"

export interface YtDlpError extends Error {
	stderr?: string
	exitCode?: number | null
	signal?: NodeJS.Signals | null
}

export function createClient({ cookieArgs = [] }: { cookieArgs?: string[] } = {}): YtDlpClient {
	function buildArgs(args: string[], auth: boolean, verbose: boolean): string[] {
		const cookies = auth ? cookieArgs : []
		const warnings = verbose ? [] : ["--no-warnings"]
		return [...cookies, ...warnings, ...args]
	}

	function execute(args: string[], options: YtDlpRunOptions): Promise<YtDlpRunResult> {
		const { timeout = 60000, auth = false, verbose = false } = options
		return new Promise((resolve, reject) => {
			const child = spawn("yt-dlp", buildArgs(args, auth, verbose), { stdio: ["ignore", "pipe", "pipe"] })
			let stdout = ""
			let stderr = ""
			let settled = false

			const timer = setTimeout(() => {
				if (settled) return
				settled = true
				child.kill("SIGKILL")
				const err: YtDlpError = new Error(`yt-dlp timed out after ${timeout}ms`)
				err.stderr = stderr
				reject(err)
			}, timeout)

			child.stdout?.on("data", (d: Buffer) => {
				stdout += d.toString()
			})
			child.stderr?.on("data", (d: Buffer) => {
				stderr += d.toString()
			})
			child.on("error", (err: Error) => {
				if (settled) return
				settled = true
				clearTimeout(timer)
				const e = err as YtDlpError
				e.stderr = stderr
				reject(e)
			})
			child.on("close", (code, signal) => {
				if (settled) return
				settled = true
				clearTimeout(timer)
				if (code === 0) {
					resolve({ stdout: stdout.trim(), stderr: stderr.trim() })
					return
				}
				const message = stderr.trim() || `yt-dlp exited with code ${code ?? "null"}`
				const err: YtDlpError = new Error(message)
				err.stderr = stderr
				err.exitCode = code
				err.signal = signal
				reject(err)
			})
		})
	}

	function run(args: string[], options: YtDlpRunOptions = {}): Promise<string> {
		return execute(args, options).then((r) => r.stdout)
	}

	function runDetailed(args: string[], options: YtDlpRunOptions = {}): Promise<YtDlpRunResult> {
		return execute(args, options)
	}

	function spawnProcess(args: string[], options: YtDlpSpawnOptions = {}) {
		const { auth = false, spawn: spawnOpts = {} as SpawnOptions } = options
		return spawn("yt-dlp", buildArgs(args, auth, false), spawnOpts)
	}

	return { run, runDetailed, spawn: spawnProcess, cookieArgs }
}
