import { describe, it, expect, vi, beforeEach } from "vitest"
import { EventEmitter } from "node:events"
import { Readable } from "node:stream"

type SpawnArgs = { cmd: string; args: string[] }

const spawnCalls: SpawnArgs[] = []
let nextChild: FakeChild | null = null

class FakeChild extends EventEmitter {
	stdout = new Readable({ read() {} })
	stderr = new Readable({ read() {} })
	killed = false
	kill(_sig?: NodeJS.Signals) {
		this.killed = true
		return true
	}
}

vi.mock("node:child_process", () => ({
	spawn: (cmd: string, args: string[]) => {
		spawnCalls.push({ cmd, args })
		const child = nextChild ?? new FakeChild()
		nextChild = null
		return child
	},
}))

const { createClient } = await import("../src/ytdlp.js")

function makeChild(): FakeChild {
	const c = new FakeChild()
	nextChild = c
	return c
}

beforeEach(() => {
	spawnCalls.length = 0
	nextChild = null
})

describe("createClient.run", () => {
	it("omits cookieArgs when auth is false (default)", async () => {
		const client = createClient({ cookieArgs: ["--cookies-from-browser", "chrome"] })
		const child = makeChild()
		const promise = client.run(["--print", "title", "URL"])
		setImmediate(() => {
			child.stdout.push("hello\n")
			child.stdout.push(null)
			child.emit("close", 0, null)
		})
		await expect(promise).resolves.toBe("hello")
		expect(spawnCalls[0].args).toEqual(["--no-warnings", "--print", "title", "URL"])
	})

	it("prepends cookieArgs when auth is true", async () => {
		const client = createClient({ cookieArgs: ["--cookies-from-browser", "chromium"] })
		const child = makeChild()
		const promise = client.run(["URL"], { auth: true })
		setImmediate(() => {
			child.stdout.push("ok\n")
			child.stdout.push(null)
			child.emit("close", 0, null)
		})
		await promise
		expect(spawnCalls[0].args).toEqual(["--cookies-from-browser", "chromium", "--no-warnings", "URL"])
	})

	it("rejects with stderr-attached error on non-zero exit", async () => {
		const client = createClient({ cookieArgs: [] })
		const child = makeChild()
		const promise = client.run(["URL"])
		setImmediate(() => {
			child.stderr.push("ERROR: could not find chrome cookies\n")
			child.stderr.push(null)
			child.emit("close", 1, null)
		})
		await expect(promise).rejects.toMatchObject({
			message: expect.stringContaining("could not find chrome cookies"),
			stderr: expect.stringContaining("could not find chrome cookies"),
			exitCode: 1,
		})
	})

	it("surfaces stderr in message even when stdout had partial content", async () => {
		const client = createClient({ cookieArgs: [] })
		const child = makeChild()
		const promise = client.run(["URL"])
		setImmediate(() => {
			child.stdout.push("partial")
			child.stderr.push("yt-dlp: fatal: bad URL\n")
			child.stdout.push(null)
			child.stderr.push(null)
			child.emit("close", 2, null)
		})
		await expect(promise).rejects.toMatchObject({
			message: "yt-dlp: fatal: bad URL",
			exitCode: 2,
		})
	})
})

describe("createClient.runDetailed", () => {
	it("returns both stdout and stderr on success", async () => {
		const client = createClient({ cookieArgs: [] })
		const child = makeChild()
		const promise = client.runDetailed(["URL"])
		setImmediate(() => {
			child.stdout.push("hello\n")
			child.stderr.push("WARNING: nothing important\n")
			child.stdout.push(null)
			child.stderr.push(null)
			child.emit("close", 0, null)
		})
		await expect(promise).resolves.toEqual({
			stdout: "hello",
			stderr: "WARNING: nothing important",
		})
	})

	it("verbose option strips --no-warnings", async () => {
		const client = createClient({ cookieArgs: [] })
		const child = makeChild()
		const promise = client.runDetailed(["URL"], { verbose: true })
		setImmediate(() => {
			child.stdout.push(null)
			child.emit("close", 0, null)
		})
		await promise
		expect(spawnCalls[0].args).toEqual(["URL"])
	})

	it("non-verbose still includes --no-warnings", async () => {
		const client = createClient({ cookieArgs: [] })
		const child = makeChild()
		const promise = client.runDetailed(["URL"])
		setImmediate(() => {
			child.stdout.push(null)
			child.emit("close", 0, null)
		})
		await promise
		expect(spawnCalls[0].args).toEqual(["--no-warnings", "URL"])
	})
})

describe("createClient.spawn", () => {
	it("omits cookieArgs when auth is false (default)", () => {
		const client = createClient({ cookieArgs: ["--cookies-from-browser", "chrome"] })
		client.spawn(["-o", "out.mp4", "URL"])
		expect(spawnCalls[0].args).toEqual(["--no-warnings", "-o", "out.mp4", "URL"])
	})

	it("prepends cookieArgs when auth is true", () => {
		const client = createClient({ cookieArgs: ["--cookies", "/c.txt"] })
		client.spawn(["URL"], { auth: true })
		expect(spawnCalls[0].args).toEqual(["--cookies", "/c.txt", "--no-warnings", "URL"])
	})
})
