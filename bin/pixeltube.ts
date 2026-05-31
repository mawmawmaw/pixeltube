#!/usr/bin/env node

// CLI entry point — parse args, validate, dispatch to command handlers

import { existsSync } from "node:fs"
import { checkTTY, emergencyRestore } from "../src/tui/terminal.js"
import { createClient } from "../src/ytdlp.js"
import { setClient as setResolveClient } from "../src/resolve.js"
import { parseArgs, cookieArgsFromOptions, validateOptions } from "../src/cli/args.js"
import { printHelp } from "../src/cli/help.js"
import { VERSION, checkForUpdates, getUpdateNotice } from "../src/cli/update-check.js"
import { cmdLogin, cmdBrowse, cmdDefaultBrowse, cmdPlayUrl, cmdPlayFile } from "../src/cli/commands.js"
import { isExtracted, tryExtractChromiumCookies } from "../src/cookie-extractor.js"

process.on("exit", () => emergencyRestore())
process.on("SIGINT", () => process.exit(0))
process.on("SIGTERM", () => process.exit(0))
process.on("uncaughtException", (err) => {
	emergencyRestore()
	console.error("Unexpected error:", err.message)
	process.exit(1)
})
process.on("unhandledRejection", (err) => {
	emergencyRestore()
	console.error("Unexpected error:", (err as Error)?.message || err)
	process.exit(1)
})

const { subcommand, input, options } = parseArgs(process.argv)

if (subcommand === "version") {
	console.log(`pixeltube v${VERSION}`)
	process.exit(0)
}

const errors = validateOptions(options)
if (errors.length > 0) {
	errors.forEach((e) => console.error(e))
	process.exit(1)
}

let cookieArgs = cookieArgsFromOptions(options)

// On Linux, yt-dlp's --cookies-from-browser is broken for Chromium-family
// browsers when other Chromium-based apps (VS Code, Slack, Discord) are
// installed — it matches keyring entries by label only and grabs the wrong
// one. Extract cookies ourselves into a temp file and pass --cookies instead.
if (cookieArgs[0] === "--cookies-from-browser") {
	const extracted = tryExtractChromiumCookies(cookieArgs[1])
	if (isExtracted(extracted)) {
		cookieArgs = ["--cookies", extracted.cookiesFile]
		process.on("exit", () => extracted.cleanup())
	} else if (extracted) {
		// Linux + supported browser but extraction failed — fall back to yt-dlp's
		// own --cookies-from-browser. The login flow will surface yt-dlp's error
		// if the fallback also fails.
		console.warn(`pixeltube cookie extractor: ${extracted.reason} — falling back to yt-dlp`)
	}
}

const ytdlp = createClient({ cookieArgs })
setResolveClient(ytdlp)

if (subcommand === "help") {
	printHelp()
	process.exit(0)
}

checkForUpdates()

checkTTY()

const SEARCH_ONLY_WARNING =
	"No supported browser cookies detected. Continuing in search-only mode.\n" +
	"Pass --browser NAME or --cookies FILE to enable subscriptions/recommendations/history.\n"

if (subcommand === "login") {
	if (cookieArgs.length === 0) {
		console.error(
			"No supported browser detected (looked for chrome, chromium, brave, edge, firefox).\n" +
				"Pass --browser NAME or --cookies FILE.",
		)
		process.exit(1)
	}
	await cmdLogin(ytdlp, cookieArgs)
	process.exit(0)
}

if (subcommand === "browse") {
	if (cookieArgs.length === 0) {
		console.warn(SEARCH_ONLY_WARNING)
		await cmdBrowse(ytdlp, { loggedIn: false })
	} else {
		await cmdBrowse(ytdlp)
	}
	process.exit(0)
}

if (!input) {
	if (cookieArgs.length === 0) {
		console.warn(SEARCH_ONLY_WARNING)
		await cmdBrowse(ytdlp, { loggedIn: false })
		process.exit(0)
	}
	await cmdDefaultBrowse(ytdlp, cookieArgs)
	process.exit(0)
}

const isURL = /^https?:\/\//.test(input)
if (!isURL && !existsSync(input)) {
	console.error(`File not found: ${input}`)
	process.exit(1)
}

const termWidth = options.width || Math.floor((process.stdout.columns || 80) * options.scale)
const playOptions = { ...options, width: termWidth }

if (isURL) {
	await cmdPlayUrl(input, playOptions)
} else {
	await cmdPlayFile(input, playOptions)
}

const notice = getUpdateNotice()
if (notice) console.error(`\n  ${notice}\n`)

process.exit(0)
