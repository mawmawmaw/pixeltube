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

const cookieArgs = cookieArgsFromOptions(options)
const ytdlp = createClient({ cookieArgs })
setResolveClient(ytdlp)

if (subcommand === "help") {
	printHelp()
	process.exit(0)
}

checkForUpdates()

checkTTY()

if (subcommand === "login") {
	await cmdLogin(ytdlp, cookieArgs)
	process.exit(0)
}

if (subcommand === "browse") {
	await cmdBrowse(ytdlp)
	process.exit(0)
}

if (!input) {
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
