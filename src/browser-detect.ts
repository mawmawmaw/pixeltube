// Detects which browser's cookies are available, per platform.
// Pure logic — only touches the filesystem via existsSync.

import { existsSync } from "node:fs"
import { join, win32 } from "node:path"

export type BrowserName = "chrome" | "chromium" | "brave" | "edge" | "firefox"

export const BROWSER_PRIORITY: BrowserName[] = ["chrome", "chromium", "brave", "edge", "firefox"]

export function isValidBrowser(name: string): name is BrowserName {
	return (BROWSER_PRIORITY as string[]).includes(name)
}

// Accepts yt-dlp's full BROWSER[+KEYRING][:PROFILE][::CONTAINER] syntax.
export function isValidBrowserSpec(spec: string): boolean {
	const base = spec.split(/[+:]/, 1)[0]
	return isValidBrowser(base)
}

type PathResolver = (env: NodeJS.ProcessEnv) => string | null

const LINUX_PATHS: Record<BrowserName, PathResolver> = {
	chrome: (env) => (env.HOME ? join(env.HOME, ".config/google-chrome") : null),
	chromium: (env) => (env.HOME ? join(env.HOME, ".config/chromium") : null),
	brave: (env) => (env.HOME ? join(env.HOME, ".config/BraveSoftware/Brave-Browser") : null),
	edge: (env) => (env.HOME ? join(env.HOME, ".config/microsoft-edge") : null),
	firefox: (env) => (env.HOME ? join(env.HOME, ".mozilla/firefox") : null),
}

const MACOS_PATHS: Record<BrowserName, PathResolver> = {
	chrome: (env) => (env.HOME ? join(env.HOME, "Library/Application Support/Google/Chrome") : null),
	chromium: (env) => (env.HOME ? join(env.HOME, "Library/Application Support/Chromium") : null),
	brave: (env) => (env.HOME ? join(env.HOME, "Library/Application Support/BraveSoftware/Brave-Browser") : null),
	edge: (env) => (env.HOME ? join(env.HOME, "Library/Application Support/Microsoft Edge") : null),
	firefox: (env) => (env.HOME ? join(env.HOME, "Library/Application Support/Firefox") : null),
}

const WINDOWS_PATHS: Record<BrowserName, PathResolver> = {
	chrome: (env) => (env.LOCALAPPDATA ? win32.join(env.LOCALAPPDATA, "Google", "Chrome", "User Data") : null),
	chromium: (env) => (env.LOCALAPPDATA ? win32.join(env.LOCALAPPDATA, "Chromium", "User Data") : null),
	brave: (env) =>
		env.LOCALAPPDATA ? win32.join(env.LOCALAPPDATA, "BraveSoftware", "Brave-Browser", "User Data") : null,
	edge: (env) => (env.LOCALAPPDATA ? win32.join(env.LOCALAPPDATA, "Microsoft", "Edge", "User Data") : null),
	firefox: (env) => (env.APPDATA ? win32.join(env.APPDATA, "Mozilla", "Firefox") : null),
}

function pathsFor(platform: NodeJS.Platform): Record<BrowserName, PathResolver> | null {
	if (platform === "linux") return LINUX_PATHS
	if (platform === "darwin") return MACOS_PATHS
	if (platform === "win32") return WINDOWS_PATHS
	return null
}

export function detectBrowsers(
	platform: NodeJS.Platform = process.platform,
	env: NodeJS.ProcessEnv = process.env,
): { available: BrowserName[]; preferred: BrowserName | null } {
	const table = pathsFor(platform)
	if (!table) return { available: [], preferred: null }

	const available: BrowserName[] = []
	for (const name of BROWSER_PRIORITY) {
		const p = table[name](env)
		if (p && existsSync(p)) available.push(name)
	}
	return { available, preferred: available[0] ?? null }
}
