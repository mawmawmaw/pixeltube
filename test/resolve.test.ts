import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { resolveInput, setClient } from "../src/resolve.js"
import type { YtDlpClient, YtDlpRunOptions } from "../src/types.js"

const URL = "https://www.youtube.com/watch?v=abc"

type FakeClient = YtDlpClient & { calls: string[][]; auths: boolean[] }

function fakeClient(
	json: object,
	{ cookieArgs = [] as string[], failAuth = false }: { cookieArgs?: string[]; failAuth?: boolean } = {},
): FakeClient {
	const calls: string[][] = []
	const auths: boolean[] = []
	return {
		calls,
		auths,
		cookieArgs,
		run: async (args: string[], options: YtDlpRunOptions = {}) => {
			calls.push(args)
			auths.push(Boolean(options.auth))
			if (options.auth && failAuth) throw new Error("cookie database is locked")
			return JSON.stringify(json)
		},
		runDetailed: async () => ({ stdout: "", stderr: "" }),
		spawn: () => {
			throw new Error("not used")
		},
	} as FakeClient
}

const progressive = {
	url: "https://rr1.googlevideo.com/videoplayback?itag=18",
	width: 640,
	height: 360,
	fps: 30,
	duration: 120,
	channel: "Chan",
}

describe("resolveInput", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-10-25T12:00:00Z"))
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	it("gets metadata and stream URL from a single yt-dlp -j call", async () => {
		const client = fakeClient(progressive)
		setClient(client)
		const result = await resolveInput(URL, { onStatus: () => {} })
		expect(client.calls).toHaveLength(1)
		expect(client.calls[0]).toContain("-j")
		expect(result.streamUrl).toBe(progressive.url)
		expect(result.meta).toEqual({ width: 640, height: 360, fps: 30, duration: 120, channel: "Chan" })
	})

	it("uses the video half of a merged format", async () => {
		setClient(
			fakeClient({
				...progressive,
				url: undefined,
				requested_formats: [{ url: "https://v/video" }, { url: "https://v/audio" }],
			}),
		)
		const result = await resolveInput(URL, { onStatus: () => {} })
		expect(result.streamUrl).toBe("https://v/video")
	})

	it("waits until available_at before returning the stream (YouTube 403s earlier)", async () => {
		const now = Math.floor(Date.now() / 1000)
		setClient(fakeClient({ ...progressive, available_at: now + 3 }))
		const statuses: string[] = []
		let resolved = false
		const promise = resolveInput(URL, { onStatus: (m) => statuses.push(m) }).then((r) => {
			resolved = true
			return r
		})

		await vi.advanceTimersByTimeAsync(3000)
		expect(resolved).toBe(false)
		await vi.advanceTimersByTimeAsync(600)
		expect(resolved).toBe(true)
		expect((await promise).streamUrl).toBe(progressive.url)
		expect(statuses.some((m) => /Waiting \ds for YouTube/.test(m))).toBe(true)
	})

	it("waits for the latest available_at across merged formats", async () => {
		const now = Math.floor(Date.now() / 1000)
		setClient(
			fakeClient({
				...progressive,
				url: undefined,
				requested_formats: [
					{ url: "https://v/video", available_at: now + 1 },
					{ url: "https://v/audio", available_at: now + 4 },
				],
			}),
		)
		let resolved = false
		void resolveInput(URL, { onStatus: () => {} }).then(() => {
			resolved = true
		})
		await vi.advanceTimersByTimeAsync(2000)
		expect(resolved).toBe(false)
		await vi.advanceTimersByTimeAsync(3000)
		expect(resolved).toBe(true)
	})

	it("does not wait when available_at is missing or already passed", async () => {
		const now = Math.floor(Date.now() / 1000)
		setClient(fakeClient({ ...progressive, available_at: now - 10 }))
		const statuses: string[] = []
		await resolveInput(URL, { onStatus: (m) => statuses.push(m) })
		expect(statuses.some((m) => m.startsWith("Waiting"))).toBe(false)
	})

	it("resolves anonymously when no cookies are configured", async () => {
		const client = fakeClient(progressive)
		setClient(client)
		await resolveInput(URL, { onStatus: () => {} })
		expect(client.auths).toEqual([false])
	})

	it("resolves signed in when cookies are available (Premium: no pre-roll wait)", async () => {
		const client = fakeClient(progressive, { cookieArgs: ["--cookies-from-browser", "chrome"] })
		setClient(client)
		await resolveInput(URL, { onStatus: () => {} })
		expect(client.auths).toEqual([true])
	})

	it("falls back to anonymous when the signed-in resolve fails", async () => {
		const client = fakeClient(progressive, { cookieArgs: ["--cookies", "/nope.txt"], failAuth: true })
		setClient(client)
		const result = await resolveInput(URL, { onStatus: () => {} })
		expect(client.auths).toEqual([true, false])
		expect(result.streamUrl).toBe(progressive.url)
	})

	it("passes local files through untouched", async () => {
		const client = fakeClient(progressive)
		setClient(client)
		const result = await resolveInput("/tmp/video.mp4")
		expect(result).toEqual({ streamUrl: "/tmp/video.mp4", isRemote: false, meta: null, cleanup: null })
		expect(client.calls).toHaveLength(0)
	})
})
