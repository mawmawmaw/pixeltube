// TextInput component — single-line editable buffer with a hardware cursor.
// Pure: paints into a provided buffer region and requests the cursor position;
// no I/O. The owning screen composes any surrounding chrome.

import type { Screen } from "../buffer.js"
import type { Rect } from "../layout.js"
import { displayWidth } from "../width.js"

export interface TextInputOptions {
	label?: string // styled prefix drawn before the value (e.g. "Search: ")
	onRepaint?: () => void
	value?: string
}

export interface TextInput {
	render(buf: Screen, rect: Rect, focused?: boolean): void
	handleKey(key: string): boolean
	getValue(): string
	setValue(v: string): void
	clear(): void
}

export function createTextInput(opts: TextInputOptions = {}): TextInput {
	let value = opts.value ?? ""
	const label = opts.label ?? ""

	function render(buf: Screen, rect: Rect, focused = true): void {
		buf.put(rect.x, rect.y, label + value)
		if (focused) {
			buf.setCursor(rect.x + displayWidth(label) + displayWidth(value), rect.y)
		}
	}

	function handleKey(key: string): boolean {
		if (key === "backspace") {
			value = value.slice(0, -1)
			opts.onRepaint?.()
			return true
		}
		// Single printable character (parseKey emits these as length-1 strings).
		if (key.length === 1) {
			value += key
			opts.onRepaint?.()
			return true
		}
		return false
	}

	return {
		render,
		handleKey,
		getValue: () => value,
		setValue(v: string): void {
			value = v
		},
		clear(): void {
			value = ""
		},
	}
}
