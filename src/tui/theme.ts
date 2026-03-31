import type { Theme } from "../types.js"

const env = process.env

// Theme detection and color system — dark/light, truecolor/256-color fallback

export const truecolor: boolean = env.COLORTERM === "truecolor" || env.COLORTERM === "24bit"
export const color256: boolean = !truecolor && (env.TERM || "").includes("256color")
export const basicColor: boolean = !truecolor && !color256
export const altScreen: boolean = env.TERM !== "dumb"
export const syncOutput: boolean = /iterm|kitty|wezterm|alacritty|ghostty/i.test(env.TERM_PROGRAM || "")

function detectDarkTheme(): boolean {
	const cfg = env.COLORFGBG
	if (cfg) {
		const parts = cfg.split(";")
		const bg = Number(parts[parts.length - 1])
		if (!isNaN(bg)) return bg < 8 // 0-7 = dark backgrounds
	}
	return true // default dark
}
export const isDark: boolean = detectDarkTheme()

function rgb(r: number, g: number, b: number): string {
	if (truecolor) return `\x1b[38;2;${r};${g};${b}m`
	// 256-color: map to 6x6x6 color cube (indices 16-231)
	const ri = Math.round((r / 255) * 5)
	const gi = Math.round((g / 255) * 5)
	const bi = Math.round((b / 255) * 5)
	return `\x1b[38;5;${16 + ri * 36 + gi * 6 + bi}m`
}

function rgbBg(r: number, g: number, b: number): string {
	if (truecolor) return `\x1b[48;2;${r};${g};${b}m`
	const ri = Math.round((r / 255) * 5)
	const gi = Math.round((g / 255) * 5)
	const bi = Math.round((b / 255) * 5)
	return `\x1b[48;5;${16 + ri * 36 + gi * 6 + bi}m`
}

export function fgRgb(r: number, g: number, b: number): string {
	if (truecolor) return `\x1b[38;2;${r};${g};${b}m`
	const ri = Math.round((r / 255) * 5)
	const gi = Math.round((g / 255) * 5)
	const bi = Math.round((b / 255) * 5)
	return `\x1b[38;5;${16 + ri * 36 + gi * 6 + bi}m`
}

export function bgRgb(r: number, g: number, b: number): string {
	if (truecolor) return `\x1b[48;2;${r};${g};${b}m`
	const ri = Math.round((r / 255) * 5)
	const gi = Math.round((g / 255) * 5)
	const bi = Math.round((b / 255) * 5)
	return `\x1b[48;5;${16 + ri * 36 + gi * 6 + bi}m`
}

const BOLD: string = "\x1b[1m"
const RESET: string = "\x1b[0m"

export const theme: Theme = isDark
	? {
			accent: "\x1b[93m", // bright yellow
			accentBold: `${BOLD}\x1b[93m`, // bold bright yellow
			shadow: rgb(255, 140, 0), // orange
			shadowBold: `${BOLD}${rgb(255, 140, 0)}`,
			dim: "\x1b[2m",
			bold: BOLD,
			reset: RESET,
			selBg: rgbBg(40, 40, 40), // dark gray background
			selArrow: `${BOLD}\x1b[93m`, // bold bright yellow
			subtitleBg: "\x1b[40m", // black bg
			subtitleFg: `${BOLD}\x1b[97m`, // bright white
			progressFill: `${BOLD}\x1b[93m`,
			progressEmpty: "\x1b[2m",
			statusTag: `${BOLD}\x1b[93m`,
			logoYellow: `${BOLD}\x1b[33m`,
		}
	: {
			accent: "\x1b[33m", // dark yellow
			accentBold: `${BOLD}\x1b[33m`,
			shadow: rgb(180, 100, 0), // darker orange
			shadowBold: `${BOLD}${rgb(180, 100, 0)}`,
			dim: "\x1b[2m",
			bold: BOLD,
			reset: RESET,
			selBg: rgbBg(220, 220, 220), // light gray background
			selArrow: `${BOLD}\x1b[33m`, // bold dark yellow
			subtitleBg: "\x1b[47m", // white bg
			subtitleFg: `${BOLD}\x1b[30m`, // black text
			progressFill: `${BOLD}\x1b[33m`,
			progressEmpty: "\x1b[2m",
			statusTag: `${BOLD}\x1b[33m`,
			logoYellow: `${BOLD}\x1b[33m`,
		}
