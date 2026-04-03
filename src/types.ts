// Shared type definitions for pixeltube

import type { ChildProcess, SpawnOptions } from "node:child_process"

// --- CLI ---

export interface CliOptions {
	fps: number | null
	width: number | null
	scale: number
	download: boolean
	audio: boolean
	cookies: string | null
}

export interface ParsedArgs {
	subcommand: string | null
	input: string | null
	options: CliOptions
}

// --- Video / Media ---

export interface VideoMeta {
	width: number
	height: number
	fps: number
	duration: number
	channel?: string
}

export interface VideoInfo {
	title?: string
	channel?: string
	duration?: number
	videoUrl?: string
}

export interface Video {
	id: string
	title: string
	channel: string
	duration: string | number
	durationFmt: string
}

export interface Playlist {
	id: string
	title: string
	videoCount: number | null
}

export interface PlaylistContext {
	videos: Video[]
	index: number
}

// --- yt-dlp ---

export interface YtDlpClient {
	run(args: string[], timeout?: number): Promise<string>
	spawn(args: string[], options?: SpawnOptions): ChildProcess
	cookieArgs: string[]
}

// --- Decoder ---

export interface Decoder {
	filePath: string
	width: number
	height: number
	fps: number
	audio: boolean
	frames: { readonly length: number }
	readonly done: boolean
	waitForFrame(): Promise<void>
	consumeFrame(): Buffer | undefined
	flushFrames(): void
	pauseStream(): void
	resumeStream(): void
	killAudio(): void
	respawnAudio(atTime: number): void
	kill(): void
}

export interface DecoderOptions {
	audio?: boolean
	startTime?: number
	startPaused?: boolean
}

// --- Resolve ---

export interface ResolveResult {
	streamUrl: string
	isRemote: boolean
	meta: VideoMeta | null
	cleanup: (() => void) | null
}

export interface ResolveOptions {
	download?: boolean
	onStatus?: (msg: string) => void
}

// --- Subtitle ---

export interface Subtitle {
	start: number
	end: number
	text: string
}

// --- Browse ---

export type ExitReason = "done" | "back" | "quit" | "next" | "prev"

export interface BrowseSelection {
	url: string
	info: VideoInfo
	streamUrl: string
	meta: VideoMeta
	cleanup: (() => void) | null
	playlist: PlaylistContext | null
}

export interface BrowseScreenState {
	title: () => string
	listView?: ListView | null
	render?: () => void
	statusHint?: string
	type?: string
}

export interface BrowseState {
	readonly stack: BrowseScreenState[]
	currentState(): BrowseScreenState | undefined
	renderCurrent(): void
	popState(): void
	pushState(state: BrowseScreenState): void
	result(value: BrowseSelection | null): void
	flashMessage(msg: string, ms?: number): Promise<void>
	setKeyHandler(handler: (key: string) => void): void
	start(): Promise<BrowseSelection | null>
	resume(resizeHandler?: () => void): Promise<BrowseSelection | null>
	exitForPlayback(resizeHandler?: () => void): void
}

// --- List View ---

export interface ListViewOptions<T> {
	items: T[]
	formatItem?: (item: T, width: number) => string
	onSelect?: (item: T, index: number) => void
	onBack?: () => void
	spacing?: number
}

export interface ListView {
	render(): void
	handleKey(key: string): void
	setItems<T>(newItems: T[]): void
	getItems<T>(): T[]
	getSelected<T>(): T
	appendItems<T>(newItems: T[]): void
	setHasMore(val: boolean): void
}

// --- Spinner ---

export interface Spinner {
	stop(): void
	update(newMessage: string): void
}

// --- Theme ---

export interface Theme {
	accent: string
	accentBold: string
	shadow: string
	shadowBold: string
	dim: string
	bold: string
	reset: string
	selBg: string
	selArrow: string
	subtitleBg: string
	subtitleFg: string
	progressFill: string
	progressEmpty: string
	statusTag: string
	logoYellow: string
}

// --- Search ---

export type SearchResult =
	| { resultType: "video"; id: string; title: string; channel: string; duration: string | number; durationFmt: string }
	| { resultType: "playlist"; id: string; title: string; videoCount: number | null }
	| { resultType: "channel"; id: string; title: string }

export interface SearchFilters {
	sort: string | null
	duration: string | null
	type: string | null
}

// --- Play ---

export interface PlayOptions {
	info?: VideoInfo
	duration?: number
	playlist?: PlaylistContext | null
}

export interface PlayVideoOptions {
	fps?: number | null
	width?: number | null
	download?: boolean
	audio?: boolean
	info?: VideoInfo
	playlist?: PlaylistContext | null
}

// --- Browse Result ---

export interface BrowseResult {
	selection: BrowseSelection | null
	resume: () => Promise<BrowseSelection | null>
}
