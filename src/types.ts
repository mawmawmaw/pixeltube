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
	// String to allow yt-dlp's BROWSER[+KEYRING][:PROFILE][::CONTAINER] syntax
	browser: string | null
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
	views?: number
}

export interface Playlist {
	id: string
	title: string
	videoCount: number | null
}

// Extra per-video metadata fetched lazily (one request per selected item) and
// merged into the detail pane. Every field is optional — extraction may omit any.
export interface VideoDetail {
	channel?: string
	uploadDate?: string // YYYYMMDD
	timestamp?: number // unix seconds
	likes?: number
	subscribers?: number
	views?: number
	description?: string
}

export interface PlaylistContext {
	videos: Video[]
	index: number
}

// --- yt-dlp ---

export interface YtDlpRunOptions {
	timeout?: number
	auth?: boolean
	verbose?: boolean
}

export interface YtDlpRunResult {
	stdout: string
	stderr: string
}

export interface YtDlpSpawnOptions {
	auth?: boolean
	spawn?: SpawnOptions
}

export interface YtDlpClient {
	run(args: string[], options?: YtDlpRunOptions): Promise<string>
	runDetailed(args: string[], options?: YtDlpRunOptions): Promise<YtDlpRunResult>
	spawn(args: string[], options?: YtDlpSpawnOptions): ChildProcess
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
	// Screen-specific key handler. When set, it receives keys before the default
	// list/back routing. Used by screens that aren't a plain ListView.
	handleKey?: (key: string) => void
	statusHint?: string
	// "SEARCH_INPUT" marks a text-capturing screen so global shortcuts (e.g. "q"
	// to quit) don't swallow typed characters.
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
	// True while the list is in type-to-filter mode (capturing typed text), so
	// global shortcuts like "q" should not be treated as quit.
	capturesText(): boolean
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
	| {
			resultType: "video"
			id: string
			title: string
			channel: string
			duration: string | number
			durationFmt: string
			views?: number
	  }
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
