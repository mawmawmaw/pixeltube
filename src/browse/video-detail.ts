// Lazy per-video detail loader — fetches extra metadata (upload date, likes,
// subscribers, description) for the selected list item and caches it by id.
// Mirrors thumbnail.ts: synchronous cache lookup on the render path, in-flight
// dedup, and a failure cache so we don't refetch in a tight loop. Everything
// degrades gracefully: callers get null and simply show less.

import type { VideoDetail } from "../types.js"
import { fetchVideoDetail } from "./data.js"

const cache = new Map<string, VideoDetail>()
const failed = new Set<string>()
const inflight = new Map<string, Promise<VideoDetail | null>>()
const MAX_CACHE = 128

function remember(id: string, detail: VideoDetail): void {
	cache.set(id, detail)
	if (cache.size > MAX_CACHE) {
		const oldest = cache.keys().next().value
		if (oldest !== undefined) cache.delete(oldest)
	}
}

// Synchronous cache lookup for the render path (no await).
export function getCachedVideoDetail(id: string): VideoDetail | null {
	return cache.get(id) ?? null
}

export function videoDetailFailed(id: string): boolean {
	return failed.has(id)
}

// Load (or return cached) detail for the given video id.
export function loadVideoDetail(id: string): Promise<VideoDetail | null> {
	const hit = cache.get(id)
	if (hit) return Promise.resolve(hit)
	if (failed.has(id)) return Promise.resolve(null)
	const pending = inflight.get(id)
	if (pending) return pending

	const job = (async () => {
		const detail = await fetchVideoDetail(id)
		if (!detail) {
			failed.add(id)
			return null
		}
		remember(id, detail)
		return detail
	})().finally(() => inflight.delete(id))

	inflight.set(id, job)
	return job
}
