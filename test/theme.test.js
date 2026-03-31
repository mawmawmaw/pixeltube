import { describe, it, expect } from "vitest"
import { theme, truecolor, isDark, fgRgb, bgRgb } from "../src/tui/theme.js"

describe("theme", () => {
	it("exports all required color keys", () => {
		const keys = [
			"accent",
			"accentBold",
			"shadow",
			"shadowBold",
			"dim",
			"bold",
			"reset",
			"selBg",
			"selArrow",
			"subtitleBg",
			"subtitleFg",
			"progressFill",
			"progressEmpty",
			"statusTag",
			"logoYellow",
		]
		for (const key of keys) {
			expect(theme[key]).toBeDefined()
			expect(typeof theme[key]).toBe("string")
		}
	})

	it("detects theme mode", () => {
		expect(typeof isDark).toBe("boolean")
	})

	it("detects truecolor", () => {
		expect(typeof truecolor).toBe("boolean")
	})
})

describe("color helpers", () => {
	it("fgRgb returns an escape sequence", () => {
		const result = fgRgb(255, 128, 0)
		expect(result).toMatch(/^\x1b\[/)
	})

	it("bgRgb returns an escape sequence", () => {
		const result = bgRgb(0, 0, 0)
		expect(result).toMatch(/^\x1b\[/)
	})
})
