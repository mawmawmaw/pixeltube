// Browse navigation state — stack-based screen management

import type { BrowseState, BrowseScreenState, BrowseSelection } from "../types.js"
import { enterRawMode, exitRawMode, onKey } from "../tui/terminal.js"
import { drawTitleBar, drawStatusBar, clearContent, startSpinner } from "../tui/screen.js"

export function createBrowseState(): BrowseState {
	const stateStack: BrowseScreenState[] = []
	let removeKeyHandler: (() => void) | null = null
	let resolvePromise: ((value: BrowseSelection | null) => void) | null = null
	let keyHandler: ((key: string) => void) | null = null

	function currentState(): BrowseScreenState | undefined {
		return stateStack[stateStack.length - 1]
	}

	function renderCurrent(): void {
		const state = currentState()
		if (!state) return
		clearContent()
		drawTitleBar(state.title())
		drawStatusBar(state.statusHint || " arrows: navigate | enter/right: select | esc/left: back | q: quit")
		if (state.render) {
			state.render()
		} else if (state.listView) {
			state.listView.render()
		}
	}

	function popState(): void {
		stateStack.pop()
		if (stateStack.length === 0) return result(null)
		renderCurrent()
	}

	function pushState(state: BrowseScreenState): void {
		stateStack.push(state)
		renderCurrent()
	}

	function result(value: BrowseSelection | null): void {
		if (removeKeyHandler) removeKeyHandler()
		resolvePromise!(value)
	}

	async function flashMessage(msg: string, ms = 2000): Promise<void> {
		clearContent()
		const s = startSpinner(msg)
		await new Promise<void>((r) => setTimeout(r, ms))
		s.stop()
		popState()
	}

	function setKeyHandler(handler: (key: string) => void): void {
		keyHandler = handler
	}

	function start(): Promise<BrowseSelection | null> {
		return new Promise((resolve) => {
			resolvePromise = resolve
			removeKeyHandler = onKey((key: string) => {
				if (keyHandler) keyHandler(key)
			})
		})
	}

	function resume(resizeHandler?: () => void): Promise<BrowseSelection | null> {
		enterRawMode()
		if (resizeHandler) process.stdout.on("resize", resizeHandler)
		renderCurrent()
		return new Promise((resolve) => {
			resolvePromise = resolve
			removeKeyHandler = onKey((key: string) => {
				if (keyHandler) keyHandler(key)
			})
		})
	}

	function exitForPlayback(resizeHandler?: () => void): void {
		if (removeKeyHandler) removeKeyHandler()
		if (resizeHandler) process.stdout.removeListener("resize", resizeHandler)
		exitRawMode()
	}

	return {
		get stack() {
			return stateStack
		},
		currentState,
		renderCurrent,
		popState,
		pushState,
		result,
		flashMessage,
		setKeyHandler,
		start,
		resume,
		exitForPlayback,
	}
}
