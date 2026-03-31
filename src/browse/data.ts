// YouTube data fetching via yt-dlp (playlists, subscriptions, search, etc.)

import type { YtDlpClient, Video, Playlist, SearchFilters } from "../types.js"
import { formatDuration } from "../utils/time.js"
import { sanitize } from "../utils/sanitize.js"
import { createClient } from "../ytdlp.js"

let client: YtDlpClient = createClient()

export function setClient(c: YtDlpClient): void {
	client = c
}

function runYtDlp(args: string[], timeout = 60000): Promise<string> {
	return client.run(args, timeout)
}

function parseJsonLines(raw: string): Record<string, unknown>[] {
	if (!raw) return []
	return raw
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			try {
				return JSON.parse(line) as Record<string, unknown>
			} catch {
				return null
			}
		})
		.filter(Boolean) as Record<string, unknown>[]
}

function clean(val: unknown): string {
	if (val == null || val === "NA" || val === "None") return ""
	return sanitize(String(val))
}

function enrichVideos(raw: string): Video[] {
	return parseJsonLines(raw)
		.map((d) => ({
			id: (d.id as string) || "",
			title: clean(d.title),
			channel: clean(d.channel || d.uploader),
			duration: (d.duration as string | number) || "",
			durationFmt: formatDuration(d.duration as number),
		}))
		.filter((v) => {
			const t = v.title.toLowerCase()
			return v.id && v.title && t !== "[deleted video]" && t !== "[private video]"
		})
}

const VIDEO_JSON = "%()j"

export async function fetchAccountName(): Promise<string | null> {
	try {
		// Watch Later playlist reliably has playlist_uploader
		const raw = await runYtDlp(
			[
				"--flat-playlist",
				"--playlist-end",
				"1",
				"--print",
				"%(playlist_uploader)s",
				"https://www.youtube.com/playlist?list=WL",
			],
			15000,
		)
		const name = raw.split("\n")[0] || ""
		return name && name !== "NA" ? name : null
	} catch {
		return null
	}
}

export async function fetchPlaylists(): Promise<Playlist[]> {
	const raw = await runYtDlp(["--flat-playlist", "--print", VIDEO_JSON, "https://www.youtube.com/feed/playlists"])
	return parseJsonLines(raw).map((d) => ({
		title: clean(d.title) || "Untitled",
		id: (d.id as string) || "",
		videoCount: null,
	}))
}

export async function fetchPlaylistCount(playlistId: string): Promise<number | null> {
	try {
		const raw = await runYtDlp(
			[
				"--flat-playlist",
				"--playlist-end",
				"1",
				"--print",
				"%(playlist_count)s",
				`https://www.youtube.com/playlist?list=${playlistId}`,
			],
			10000,
		)
		const n = Number(raw.split("\n")[0])
		return isNaN(n) ? null : n
	} catch {
		return null
	}
}

export async function fetchPlaylistVideos(playlistId: string): Promise<Video[]> {
	const raw = await runYtDlp([
		"--flat-playlist",
		"--print",
		VIDEO_JSON,
		`https://www.youtube.com/playlist?list=${playlistId}`,
	])
	return enrichVideos(raw)
}

export async function fetchSubscriptions(): Promise<Video[]> {
	const raw = await runYtDlp([
		"--flat-playlist",
		"--playlist-end",
		"30",
		"--print",
		VIDEO_JSON,
		"https://www.youtube.com/feed/subscriptions",
	])
	return enrichVideos(raw)
}

export async function fetchRecommendations(): Promise<Video[]> {
	const raw = await runYtDlp([
		"--flat-playlist",
		"--playlist-end",
		"30",
		"--print",
		VIDEO_JSON,
		"https://www.youtube.com/feed/recommended",
	])
	return enrichVideos(raw)
}

export async function fetchHistory(): Promise<Video[]> {
	const raw = await runYtDlp([
		"--flat-playlist",
		"--playlist-end",
		"30",
		"--print",
		VIDEO_JSON,
		"https://www.youtube.com/feed/history",
	])
	return enrichVideos(raw)
}

export async function fetchPlaylistByUrl(url: string): Promise<Video[]> {
	const raw = await runYtDlp(["--flat-playlist", "--print", VIDEO_JSON, url])
	return enrichVideos(raw)
}

export async function search(query: string, filters: SearchFilters | null = null): Promise<Video[]> {
	if (!filters) {
		const raw = await runYtDlp(["--flat-playlist", "--print", VIDEO_JSON, `ytsearch20:${query}`])
		return enrichVideos(raw)
	}

	// sp is a base64-encoded protobuf; these are the known values:
	const spParts: string[] = []

	// Sort: CAI=upload_date, CAM=view_count, CAE=rating
	const sortMap: Record<string, string> = { date: "CAI", views: "CAM", rating: "CAE" }
	if (filters.sort && sortMap[filters.sort]) spParts.push(sortMap[filters.sort])

	// Duration: EgIYAQ=short, EgIYAw=medium, EgIYAg=long
	const durMap: Record<string, string> = { short: "EgIYAQ", medium: "EgIYAw", long: "EgIYAg" }
	if (filters.duration && durMap[filters.duration]) spParts.push(durMap[filters.duration])

	// Type: EgIQAQ=video (default for us)
	spParts.push("EgIQAQ")

	const sp = spParts.length > 0 ? `&sp=${encodeURIComponent(spParts.join(""))}` : ""
	const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${sp}`

	const raw = await runYtDlp(["--flat-playlist", "--playlist-end", "20", "--print", VIDEO_JSON, searchUrl])
	return enrichVideos(raw)
}

export { formatDuration }
