import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createHelpScreen } from "../src/browse/screens/help.js"
import { stripAnsi } from "../src/tui/width.js"
import type { BrowseState, BrowseScreenState } from "../src/types.js"

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

describe("help overlay", () => {
	it("pushes a HELP screen and renders shortcuts", () => {
		const writes: string[] = []
		vi.spyOn(process.stdout, "write").mockImplementation((c: unknown) => {
			writes.push(String(c))
			return true
		})

		let pushed: BrowseScreenState | null = null
		const stubState = {
			pushState: (s: BrowseScreenState) => {
				pushed = s
			},
			popState: vi.fn(),
		} as unknown as BrowseState

		const help = createHelpScreen(stubState)
		help.open()
		expect(pushed).not.toBeNull()
		expect(pushed!.type).toBe("HELP")

		pushed!.render!()
		const out = stripAnsi(writes.join(""))
		expect(out).toContain("Keyboard shortcuts")
		expect(out).toContain("Filter the list")
		expect(out).toContain("Quit")
	})

	it("close pops the state", () => {
		const popState = vi.fn()
		const stubState = { pushState: vi.fn(), popState } as unknown as BrowseState
		createHelpScreen(stubState).close()
		expect(popState).toHaveBeenCalledTimes(1)
	})
})
