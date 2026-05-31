// CLI argument parsing and validation (no dependencies)

import { existsSync } from "node:fs"
import { BROWSER_PRIORITY, detectBrowsers, isValidBrowserSpec } from "../browser-detect.js"
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
		browser: null,
	}

	const first = args[0]
	if (first === "help" || first === "--help" || first === "-h") return { subcommand: "help", input: null, options }
	if (first === "--version" || first === "-V") return { subcommand: "version", input: null, options }
	if (first === "login") return { subcommand: "login", input: null, options: parseAuthFlags(args, options) }
	if (first === "browse") return { subcommand: "browse", input: null, options: parseAuthFlags(args, options) }

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
		} else if (args[i] === "--browser") {
			options.browser = args[++i]
		} else if (args[i] === "--help" || args[i] === "-h") {
			return { subcommand: "help", input: null, options }
		} else if (args[i] === "--version" || args[i] === "-V") {
			return { subcommand: "version", input: null, options }
		} else if (!input) {
			input = args[i]
		}
	}

	return { subcommand, input, options }
}

function parseAuthFlags(args: string[], options: CliOptions): CliOptions {
	const cookieIdx = args.indexOf("--cookies")
	if (cookieIdx !== -1 && args[cookieIdx + 1]) {
		options.cookies = args[cookieIdx + 1]
	}
	const browserIdx = args.indexOf("--browser")
	if (browserIdx !== -1 && args[browserIdx + 1]) {
		options.browser = args[browserIdx + 1]
	}
	return options
}

export function cookieArgsFromOptions(options: CliOptions): string[] {
	if (options.cookies) {
		return ["--cookies", options.cookies]
	}
	if (options.browser) {
		return ["--cookies-from-browser", options.browser]
	}
	const { preferred } = detectBrowsers()
	return preferred ? ["--cookies-from-browser", preferred] : []
}

export function validateOptions(options: CliOptions): string[] {
	const errors: string[] = []
	if (options.cookies && !existsSync(options.cookies)) {
		errors.push(`Cookies file not found: ${options.cookies}`)
	}
	if (options.browser && !isValidBrowserSpec(options.browser)) {
		errors.push(
			`Invalid --browser value: ${options.browser}. Must start with one of: ${BROWSER_PRIORITY.join(", ")}` +
				" (optionally followed by +keyring or :profile, e.g. chromium+gnomekeyring:Default)",
		)
	}
	if (options.fps != null && (isNaN(options.fps) || options.fps <= 0)) {
		errors.push(`Invalid fps: ${options.fps}`)
	}
	if (options.scale != null && (isNaN(options.scale) || options.scale <= 0)) {
		errors.push(`Invalid scale: ${options.scale}`)
	}
	return errors
}
