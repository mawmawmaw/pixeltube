// Time formatting utilities shared across player and browse

export function formatTime(secs) {
	const s = Math.max(0, Math.floor(secs))
	const h = Math.floor(s / 3600)
	const m = Math.floor((s % 3600) / 60)
	const sec = s % 60
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
	return `${m}:${String(sec).padStart(2, "0")}`
}

export function formatDuration(secs) {
	const n = Math.round(Number(secs) || 0)
	if (n <= 0) return ""
	return formatTime(n)
}
