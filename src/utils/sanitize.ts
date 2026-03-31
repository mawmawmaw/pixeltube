// Strip ANSI escapes and control chars from untrusted text (video titles, etc.)
export function sanitize(str: string): string {
	if (!str) return ""
	return str
		.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "") // ANSI escape sequences
		.replace(/\x1b\][^\x07]*\x07/g, "") // OSC sequences (title changes etc)
		.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "") // control chars (keep \n \r \t)
}
