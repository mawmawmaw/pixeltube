// YouTube authentication check via yt-dlp cookies

import type { YtDlpClient } from "./types.js"

export async function isLoggedIn(client: YtDlpClient): Promise<boolean> {
	try {
		const result = await client.run(
			["--flat-playlist", "--playlist-end", "1", "--print", "%(title)s", "https://www.youtube.com/feed/subscriptions"],
			15000,
		)
		return !!result
	} catch {
		return false
	}
}

export async function verifyLogin(client: YtDlpClient, cookieArgs: string[]): Promise<boolean> {
	const usingFile: boolean = cookieArgs[0] === "--cookies"
	if (usingFile) {
		console.log(`Checking YouTube authentication via cookies file: ${cookieArgs[1]}\n`)
	} else {
		console.log("Checking YouTube authentication via browser cookies...")
		console.log("(macOS will prompt for your password to access Chrome cookies — this is normal)\n")
	}

	try {
		const result = await client.run(
			["--flat-playlist", "--playlist-end", "1", "--print", "%(title)s", "https://www.youtube.com/feed/subscriptions"],
			30000,
		)

		if (result) {
			console.log("Logged in!")
			return true
		} else {
			console.log("Connected but no subscriptions found.")
			console.log("Make sure you are logged into YouTube in Chrome.")
			return false
		}
	} catch (err) {
		console.error("Login check failed.\n")
		if (usingFile) {
			console.error("Make sure:")
			console.error(`  1. The cookies file exists: ${cookieArgs[1]}`)
			console.error("  2. It was exported while logged into YouTube")
			console.error("  3. The cookies have not expired (re-export if needed)")
		} else {
			console.error("Make sure:")
			console.error("  1. You are logged into YouTube in Chrome")
			console.error("  2. Chrome is fully closed (yt-dlp needs to read the cookie database)")
			console.error("  3. yt-dlp is up to date: brew upgrade yt-dlp")
		}
		console.error("\nError:", (err as Error).message)
		process.exit(1)
	}
}
