import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMainMenu } from "../src/browse/screens/main-menu.js"
import { stripAnsi } from "../src/tui/width.js"
import type { BrowseState } from "../src/types.js"

// Integration: exercises main-menu draw() through the real content buffer to
// validate the screen.ts/buffer.ts wiring with concrete terminal dimensions.

const origCols = (process.stdout as { columns?: number }).columns
const origRows = (process.stdout as { rows?: number }).rows

beforeEach(() => {
	;(process.stdout as { columns?: number }).columns = 100
	;(process.stdout as { rows?: number }).rows = 30
})
afterEach(() => {
	;(process.stdout as { columns?: number }).columns = origCols
	;(process.stdout as { rows?: number }).rows = origRows
	vi.restoreAllMocks()
})

function captureDraw(accountName: string | null, loggedIn: boolean): string {
	const writes: string[] = []
	vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
		writes.push(String(chunk))
		return true
	})
	const stubState = { pushState: vi.fn(), result: vi.fn() } as unknown as BrowseState
	const menu = createMainMenu(stubState, accountName, vi.fn(), { loggedIn })
	menu.draw()
	return stripAnsi(writes.join(""))
}

describe("main menu rendering", () => {
	it("renders all menu items when logged in", () => {
		const out = captureDraw("alice", true)
		for (const label of ["Recommendations", "Subscriptions", "Playlists", "History", "Search"]) {
			expect(out).toContain(label)
		}
	})

	it("shows only Search when not logged in", () => {
		const out = captureDraw(null, false)
		expect(out).toContain("Search")
		expect(out).not.toContain("Recommendations")
	})

	it("moving the selection down still renders all items", () => {
		const writes: string[] = []
		vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
			writes.push(String(chunk))
			return true
		})
		const stubState = { pushState: vi.fn(), result: vi.fn() } as unknown as BrowseState
		const menu = createMainMenu(stubState, "bob", vi.fn(), { loggedIn: true })
		menu.draw()
		menu.handleKey("down") // triggers a repaint via onRepaint=draw
		const out = stripAnsi(writes.join(""))
		expect(out).toContain("Subscriptions")
	})
})
