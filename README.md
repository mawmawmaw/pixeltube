# PixelTube

```

            ███                       ████   █████               █████
           ░░░                       ░░███  ░░███               ░░███
 ████████  ████  █████ █████  ██████  ░███  ███████   █████ ████ ░███████   ██████
░░███░░███░░███ ░░███ ░░███  ███░░███ ░███ ░░░███░   ░░███ ░███  ░███░░███ ███░░███
 ░███ ░███ ░███  ░░░█████░  ░███████  ░███   ░███     ░███ ░███  ░███ ░███░███████
 ░███ ░███ ░███   ███░░░███ ░███░░░   ░███   ░███ ███ ░███ ░███  ░███ ░███░███░░░
 ░███████  █████ █████ █████░░██████  █████  ░░█████  ░░████████ ████████ ░░██████
 ░███░░░  ░░░░░ ░░░░░ ░░░░░  ░░░░░░  ░░░░░    ░░░░░    ░░░░░░░░ ░░░░░░░░   ░░░░░░
 ░███
 █████
░░░░░
```

**Play videos as colored pixel art in your terminal.** Browse YouTube, stream videos, manage playlists — all from the command line.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-required-007808?logo=ffmpeg&logoColor=white)](https://ffmpeg.org)
[![yt--dlp](https://img.shields.io/badge/yt--dlp-required-red?logo=youtube&logoColor=white)](https://github.com/yt-dlp/yt-dlp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## Features

- **Terminal video playback** — renders video frames as colored Unicode half-blocks with 24-bit truecolor
- **YouTube integration** — browse recommendations, subscriptions, playlists, history, and search
- **Audio playback** — synced audio via ffplay, with mute toggle
- **Player controls** — pause/play, rewind/forward, next/prev track, subtitles
- **Continuous playlist playback** — auto-advances through playlists with next/prev support
- **Subtitles** — auto-downloads and overlays English subtitles
- **Search with filters** — sort by date/views/rating, filter by duration
- **Responsive UI** — adapts to terminal size with multiple layout tiers
- **Theme aware** — detects dark/light terminal themes
- **256-color fallback** — works on terminals without truecolor support

## Requirements

| Tool            | Install                          | Purpose                      |
| --------------- | -------------------------------- | ---------------------------- |
| **Node.js** 18+ | [nodejs.org](https://nodejs.org) | Runtime                      |
| **FFmpeg**      | `brew install ffmpeg`            | Video decoding & audio       |
| **yt-dlp**      | `brew install yt-dlp`            | YouTube streaming & browsing |

> Requires an interactive terminal (TTY) with truecolor support. Works best with iTerm2, kitty, WezTerm, Alacritty, or Ghostty. Falls back to 256-color on older terminals.

## Quick Start

```bash
# Clone and run
git clone https://github.com/mawmawmaw/pixeltube.git
cd pixeltube

# Browse YouTube (default)
node bin/pixeltube.js

# Play a local file
node bin/pixeltube.js video.mp4

# Play a YouTube URL
node bin/pixeltube.js https://youtu.be/dQw4w9WgXcQ

# Play a playlist URL
node bin/pixeltube.js 'https://www.youtube.com/playlist?list=PLrAXtmErZgOe...'
```

## Commands

| Command      | Description                  |
| ------------ | ---------------------------- |
| `pixeltube`        | Launch browse mode (default) |
| `pixeltube<file>` | Play a local video file      |
| `pixeltube<url>`  | Stream a YouTube video       |
| `pixeltubebrowse` | Browse YouTube interactively |
| `pixeltubelogin`  | Check YouTube authentication |
| `pixeltubehelp`   | Show full documentation      |

## Options

```
--fps, -f N        Override framerate
--width, -w N      Override pixel width
--scale, -s N      Scale factor (0.5 = chunky, 1.0 = fill terminal)
--dl               Download video first (slower but reliable)
--no-audio         Disable audio playback
--cookies FILE     Use exported cookies.txt instead of Chrome cookies
```

## Player Controls

| Key            | Action           |
| -------------- | ---------------- |
| `Space`        | Pause / Play     |
| `r`            | Rewind 10s       |
| `f`            | Forward 10s      |
| `n`            | Next track       |
| `p`            | Previous track   |
| `m`            | Mute / Unmute    |
| `s`            | Toggle subtitles |
| `q`            | Quit             |
| `Esc` / `Left` | Back to browse   |

## Browse Navigation

| Key               | Action                          |
| ----------------- | ------------------------------- |
| `Up` / `Down`     | Navigate list                   |
| `Enter` / `Right` | Select                          |
| `Esc` / `Left`    | Go back                         |
| `Tab`             | Search filters (in search mode) |
| `q`               | Quit                            |

## Authentication

PixelTube uses your Chrome browser cookies to access your YouTube account. No API keys needed.

```bash
# Default: reads cookies from Chrome (macOS Keychain prompt)
pixeltubelogin

# Alternative: use an exported cookies.txt file
pixeltubelogin --cookies ~/cookies.txt
```

> **Notes:** You must be logged in Youtube on Chrome for cookie access to work. You may also be prompted to grant access to the cookie vault to read the session cookie.

## How It Works

```
Video Source → yt-dlp → ffmpeg (decode + scale) → Raw RGB frames → ANSI renderer → Terminal
                                                       ↓
                                                  ffplay (audio)
```

1. **yt-dlp** resolves YouTube URLs to direct stream URLs
2. **ffmpeg** decodes and downscales video to terminal dimensions using nearest-neighbor scaling
3. Each frame is rendered as Unicode half-blocks (`▄`) with 24-bit truecolor ANSI escape codes
4. Frame diffing only sends changed pixels to minimize terminal output
5. **ffplay** handles audio playback in a separate process
6. Wall-clock timing keeps video and audio in sync

## Development

```bash
npm install

# Run tests
npm test

# Lint
npm run lint

# Format (tabs, no semicolons)
npm run format

# All checks
npm run check
```

## License

[MIT](./LICENSE) &copy; 2026 Mauricio Garcia de Ceca Garcia ([0xMaw](https://maw.dev))
