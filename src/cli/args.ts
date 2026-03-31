// CLI argument parsing and validation (no dependencies)

import { existsSync } from "node:fs"
import type { CliOptions, ParsedArgs } from "../types.js"

export function parseArgs(argv: string[]): ParsedArgs {
	const args = argv.slice(2)
	let input: string | null = null
	let subcommand: string | null = null
	const options: CliOptions = {
		fps: null,
		width: null,
		scale: 1.0,
		download: false,
		audio: true,
		cookies: null,
	}

	const first = args[0]
	if (first === "help" || first === "--help" || first === "-h") return { subcommand: "help", input: null, options }
	if (first === "login") return { subcommand: "login", input: null, options: parseCookies(args, options) }
	if (first === "browse") return { subcommand: "browse", input: null, options: parseCookies(args, options) }

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--fps" || args[i] === "-f") {
			options.fps = Number(args[++i])
		} else if (args[i] === "--width" || args[i] === "-w") {
			options.width = Number(args[++i])
		} else if (args[i] === "--scale" || args[i] === "-s") {
			options.scale = Number(args[++i])
		} else if (args[i] === "--dl") {
			options.download = true
		} else if (args[i] === "--no-audio") {
			options.audio = false
		} else if (args[i] === "--cookies") {
			options.cookies = args[++i]
		} else if (args[i] === "--help" || args[i] === "-h") {
			return { subcommand: "help", input: null, options }
		} else if (!input) {
			input = args[i]
		}
	}

	return { subcommand, input, options }
}

function parseCookies(args: string[], options: CliOptions): CliOptions {
	const idx = args.indexOf("--cookies")
	if (idx !== -1 && args[idx + 1]) {
		options.cookies = args[idx + 1]
	}
	return options
}

export function cookieArgsFromOptions(options: CliOptions): string[] {
	if (options.cookies) {
		return ["--cookies", options.cookies]
	}
	return ["--cookies-from-browser", "chrome"]
}

export function validateOptions(options: CliOptions): string[] {
	const errors: string[] = []
	if (options.cookies && !existsSync(options.cookies)) {
		errors.push(`Cookies file not found: ${options.cookies}`)
	}
	if (options.fps != null && (isNaN(options.fps) || options.fps <= 0)) {
		errors.push(`Invalid fps: ${options.fps}`)
	}
	if (options.scale != null && (isNaN(options.scale) || options.scale <= 0)) {
		errors.push(`Invalid scale: ${options.scale}`)
	}
	return errors
}
