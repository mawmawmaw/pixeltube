// YouTube thumbnail loader — fetches a video's thumbnail and decodes it to a
// raw RGB24 buffer sized for half-block rendering. Results are cached by id and
// target size; failures are cached too so we don't refetch in a tight loop.
// Everything degrades gracefully: callers get null and show a placeholder.

import { spawn } from "node:child_process"

const cache = new Map<string, Buffer>()
const failed = new Set<string>()
const inflight = new Map<string, Promise<Buffer | null>>()
const MAX_CACHE = 64

function key(id: string, w: number, h: number): string {
	return `${id}:${w}x${h}`
}

function remember(k: string, buf: Buffer): void {
	cache.set(k, buf)
	if (cache.size > MAX_CACHE) {
		const oldest = cache.keys().next().value
		if (oldest !== undefined) cache.delete(oldest)
	}
}

// Synchronous cache lookup for the render path (no await).
export function getCachedThumbnail(id: string, w: number, h: number): Buffer | null {
	return cache.get(key(id, w, h)) ?? null
}

export function thumbnailFailed(id: string, w: number, h: number): boolean {
	return failed.has(key(id, w, h))
}

async function fetchBytes(id: string): Promise<Buffer | null> {
	for (const name of ["mqdefault", "hqdefault"]) {
		try {
			const res = await fetch(`https://i.ytimg.com/vi/${id}/${name}.jpg`)
			if (!res.ok) continue
			const buf = Buffer.from(await res.arrayBuffer())
			if (buf.length > 0) return buf
		} catch {
			// try next variant
		}
	}
	return null
}

// Decode JPEG bytes to RGB24 at exactly w×h pixels via ffmpeg.
function decode(jpeg: Buffer, w: number, h: number): Promise<Buffer | null> {
	return new Promise((resolve) => {
		let proc: ReturnType<typeof spawn>
		try {
			proc = spawn("ffmpeg", [
				"-i",
				"pipe:0",
				"-vf",
				`scale=${w}:${h}:flags=bilinear`,
				"-f",
				"rawvideo",
				"-pix_fmt",
				"rgb24",
				"-v",
				"quiet",
				"pipe:1",
			])
		} catch {
			return resolve(null)
		}

		const chunks: Buffer[] = []
		const expected = w * h * 3
		const timer = setTimeout(() => {
			proc.kill("SIGKILL")
			resolve(null)
		}, 8000)

		proc.stdout?.on("data", (c: Buffer) => chunks.push(c))
		proc.on("error", () => {
			clearTimeout(timer)
			resolve(null)
		})
		proc.on("close", () => {
			clearTimeout(timer)
			const out = Buffer.concat(chunks)
			resolve(out.length >= expected ? out.subarray(0, expected) : null)
		})

		proc.stdin?.on("error", () => {})
		proc.stdin?.end(jpeg)
	})
}

// Load (or return cached) RGB24 buffer of w×h pixels for the given video id.
export function loadThumbnail(id: string, w: number, h: number): Promise<Buffer | null> {
	const k = key(id, w, h)
	const hit = cache.get(k)
	if (hit) return Promise.resolve(hit)
	if (failed.has(k)) return Promise.resolve(null)
	const pending = inflight.get(k)
	if (pending) return pending

	const job = (async () => {
		const jpeg = await fetchBytes(id)
		if (!jpeg) {
			failed.add(k)
			return null
		}
		const rgb = await decode(jpeg, w, h)
		if (!rgb) {
			failed.add(k)
			return null
		}
		remember(k, rgb)
		return rgb
	})().finally(() => inflight.delete(k))

	inflight.set(k, job)
	return job
}
