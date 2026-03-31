// YouTube data fetching via yt-dlp (playlists, subscriptions, search, etc.)

import { formatDuration } from "../utils/time.js"
import { sanitize } from "../utils/sanitize.js"
import { createClient } from "../ytdlp.js"

let client = createClient()

export function setClient(c) {
	client = c
}

function runYtDlp(args, timeout = 60000) {
	return client.run(args, timeout)
}

function parseJsonLines(raw) {
	if (!raw) return []
	return raw
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			try {
				return JSON.parse(line)
			} catch {
				return null
			}
		})
		.filter(Boolean)
}

function clean(val) {
	if (val == null || val === "NA" || val === "None") return ""
	return sanitize(String(val))
}

function enrichVideos(raw) {
	return parseJsonLines(raw)
		.map((d) => ({
			id: d.id || "",
			title: clean(d.title),
			channel: clean(d.channel || d.uploader),
			duration: d.duration || "",
			durationFmt: formatDuration(d.duration),
		}))
		.filter((v) => {
			const t = v.title.toLowerCase()
			return v.id && v.title && t !== "[deleted video]" && t !== "[private video]"
		})
}

const VIDEO_JSON = "%()j"

export async function fetchAccountName() {
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

export async function fetchPlaylists() {
	const raw = await runYtDlp(["--flat-playlist", "--print", VIDEO_JSON, "https://www.youtube.com/feed/playlists"])
	return parseJsonLines(raw).map((d) => ({
		title: clean(d.title) || "Untitled",
		id: d.id || "",
		videoCount: null,
	}))
}

export async function fetchPlaylistCount(playlistId) {
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

export async function fetchPlaylistVideos(playlistId) {
	const raw = await runYtDlp([
		"--flat-playlist",
		"--print",
		VIDEO_JSON,
		`https://www.youtube.com/playlist?list=${playlistId}`,
	])
	return enrichVideos(raw)
}

export async function fetchSubscriptions() {
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

export async function fetchRecommendations() {
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

export async function fetchHistory() {
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

export async function fetchPlaylistByUrl(url) {
	const raw = await runYtDlp(["--flat-playlist", "--print", VIDEO_JSON, url])
	return enrichVideos(raw)
}

export async function search(query, filters = null) {
	if (!filters) {
		const raw = await runYtDlp(["--flat-playlist", "--print", VIDEO_JSON, `ytsearch20:${query}`])
		return enrichVideos(raw)
	}

	// sp is a base64-encoded protobuf; these are the known values:
	const spParts = []

	// Sort: CAI=upload_date, CAM=view_count, CAE=rating
	const sortMap = { date: "CAI", views: "CAM", rating: "CAE" }
	if (filters.sort && sortMap[filters.sort]) spParts.push(sortMap[filters.sort])

	// Duration: EgIYAQ=short, EgIYAw=medium, EgIYAg=long
	const durMap = { short: "EgIYAQ", medium: "EgIYAw", long: "EgIYAg" }
	if (filters.duration && durMap[filters.duration]) spParts.push(durMap[filters.duration])

	// Type: EgIQAQ=video (default for us)
	spParts.push("EgIQAQ")

	const sp = spParts.length > 0 ? `&sp=${encodeURIComponent(spParts.join(""))}` : ""
	const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${sp}`

	const raw = await runYtDlp(["--flat-playlist", "--playlist-end", "20", "--print", VIDEO_JSON, searchUrl])
	return enrichVideos(raw)
}

export { formatDuration }
