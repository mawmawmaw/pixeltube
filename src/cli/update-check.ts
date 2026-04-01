// Version detection, update checking against npm registry, and install method detection

import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"

const CACHE_TTL = 86_400_000 // 24 hours
const FETCH_TIMEOUT = 3000
const REGISTRY_URL = "https://registry.npmjs.org/pixeltube/latest"

function readVersion(): string {
	let dir = dirname(fileURLToPath(import.meta.url))
	for (let i = 0; i < 5; i++) {
		try {
			const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
			if (pkg.name === "pixeltube") return pkg.version
		} catch {}
		dir = dirname(dir)
	}
	return "0.0.0"
}

export const VERSION: string = readVersion()

export function isNewer(current: string, latest: string): boolean {
	const a = current.split(".").map(Number)
	const b = latest.split(".").map(Number)
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		const av = a[i] || 0
		const bv = b[i] || 0
		if (bv > av) return true
		if (bv < av) return false
	}
	return false
}

export function getInstallMethod(): "brew" | "npm" {
	try {
		const realPath = realpathSync(process.argv[1])
		if (realPath.includes("/Cellar/") || realPath.includes("homebrew")) return "brew"
	} catch {}
	return "npm"
}

interface UpdateCache {
	latest: string
	checkedAt: number
}

function getCacheDir(): string {
	const xdg = process.env.XDG_CACHE_HOME
	const base = xdg || join(homedir(), ".cache")
	return join(base, "pixeltube")
}

function readCache(): UpdateCache | null {
	try {
		return JSON.parse(readFileSync(join(getCacheDir(), "update-check.json"), "utf8"))
	} catch {
		return null
	}
}

function writeCache(latest: string): void {
	try {
		const dir = getCacheDir()
		mkdirSync(dir, { recursive: true })
		writeFileSync(join(dir, "update-check.json"), JSON.stringify({ latest, checkedAt: Date.now() }))
	} catch {}
}

let updateNotice: string | null = null

function buildNotice(latest: string): string {
	const method = getInstallMethod()
	const cmd = method === "brew" ? "brew update && brew upgrade pixeltube" : "npm i -g pixeltube"
	return `Update available: ${VERSION} → ${latest}  |  ${cmd}`
}

async function fetchLatest(): Promise<void> {
	const res = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
	const data = (await res.json()) as { version: string }
	const latest = data.version
	writeCache(latest)
	if (isNewer(VERSION, latest)) updateNotice = buildNotice(latest)
}

export function checkForUpdates(): void {
	try {
		const cache = readCache()
		if (cache && Date.now() - cache.checkedAt < CACHE_TTL) {
			if (isNewer(VERSION, cache.latest)) updateNotice = buildNotice(cache.latest)
			return
		}
	} catch {}
	fetchLatest().catch(() => {})
}

export function getUpdateNotice(): string | null {
	return updateNotice
}
