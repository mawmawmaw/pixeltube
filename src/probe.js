// Video metadata extraction via ffprobe

import { execFile } from "node:child_process"

export function probe(filePath) {
	return new Promise((resolve, reject) => {
		execFile(
			"ffprobe",
			["-v", "quiet", "-print_format", "json", "-show_streams", "-select_streams", "v:0", filePath],
			(err, stdout) => {
				if (err) return reject(new Error(`ffprobe failed: ${err.message}`))

				const data = JSON.parse(stdout)
				const stream = data.streams?.[0]
				if (!stream) return reject(new Error("No video stream found"))

				const [num, den] = (stream.r_frame_rate || "24/1").split("/")
				const fps = den ? num / den : Number(num)

				resolve({
					width: Number(stream.width),
					height: Number(stream.height),
					fps,
					duration: Number(stream.duration || 0),
				})
			},
		)
	})
}
