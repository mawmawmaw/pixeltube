// Browse navigation state — stack-based screen management

import { enterRawMode, exitRawMode, onKey } from "../tui/terminal.js"
import { drawTitleBar, drawStatusBar, clearContent, startSpinner } from "../tui/screen.js"

export function createBrowseState() {
	const stateStack = []
	let removeKeyHandler = null
	let resolvePromise = null
	let keyHandler = null

	function currentState() {
		return stateStack[stateStack.length - 1]
	}

	function renderCurrent() {
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

	function popState() {
		stateStack.pop()
		if (stateStack.length === 0) return result(null)
		renderCurrent()
	}

	function pushState(state) {
		stateStack.push(state)
		renderCurrent()
	}

	function result(value) {
		if (removeKeyHandler) removeKeyHandler()
		resolvePromise(value)
	}

	async function flashMessage(msg, ms = 2000) {
		clearContent()
		const s = startSpinner(msg)
		await new Promise((r) => setTimeout(r, ms))
		s.stop()
		popState()
	}

	function setKeyHandler(handler) {
		keyHandler = handler
	}

	function start() {
		return new Promise((resolve) => {
			resolvePromise = resolve
			removeKeyHandler = onKey((key) => {
				if (keyHandler) keyHandler(key)
			})
		})
	}

	function resume(resizeHandler) {
		enterRawMode()
		if (resizeHandler) process.stdout.on("resize", resizeHandler)
		renderCurrent()
		return new Promise((resolve) => {
			resolvePromise = resolve
			removeKeyHandler = onKey((key) => {
				if (keyHandler) keyHandler(key)
			})
		})
	}

	function exitForPlayback(resizeHandler) {
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
