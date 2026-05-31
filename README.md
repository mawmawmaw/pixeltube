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
Pixeltube lets you link your Youtube account using cookies and browse your subsciptions, recommendations, playlists and history. If you don't want to link your account, you can still search for whatever you like and enjoy.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-required-007808?logo=ffmpeg&logoColor=white)](https://ffmpeg.org)
[![yt--dlp](https://img.shields.io/badge/yt--dlp-required-red?logo=youtube&logoColor=white)](https://github.com/yt-dlp/yt-dlp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## Features

- **Terminal video playback** — renders video frames as colored Unicode half-blocks with 24-bit truecolor
- **YouTube integration** — browse recommendations, subscriptions, playlists, history, and search (no login required for search)
- **Audio playback** — synced audio via ffplay, with mute toggle
- **Player controls** — pause/play, rewind/forward, next/prev track, subtitles
- **Continuous playlist playback** — auto-advances through playlists with next/prev support
- **Subtitles** — auto-downloads and overlays English subtitles
- **Search with filters** — sort by date/views/rating, filter by duration and type (videos, playlists, channels)
- **Update notifications** — checks for new versions and shows the appropriate update command
- **Responsive UI** — adapts to terminal size with multiple layout tiers
- **Theme aware** — detects dark/light terminal themes
- **256-color fallback** — works on terminals without truecolor support

## Requirements

| Tool            | Purpose                                     |
| --------------- | ------------------------------------------- |
| **Node.js** 18+ | Runtime ([nodejs.org](https://nodejs.org))  |
| **FFmpeg**      | Video decoding & audio                      |
| **yt-dlp**      | YouTube streaming & browsing                |

Install FFmpeg and yt-dlp:

| Platform      | Command                              |
| ------------- | ------------------------------------ |
| macOS         | `brew install ffmpeg yt-dlp`         |
| Debian/Ubuntu | `sudo apt install ffmpeg yt-dlp`     |
| Arch          | `sudo pacman -S ffmpeg yt-dlp`       |
| Fedora        | `sudo dnf install ffmpeg yt-dlp`     |
| Windows       | `winget install ffmpeg yt-dlp`       |

> Requires an interactive terminal (TTY) with truecolor support. Works best with iTerm2, kitty, WezTerm, Alacritty, or Ghostty. Falls back to 256-color on older terminals.

## Install

### Homebrew (recommended)

```bash
brew tap mawmawmaw/tap
brew install pixeltube
```

### npm

```bash
npm i -g pixeltube
```

### From source

```bash
git clone https://github.com/mawmawmaw/pixeltube.git
cd pixeltube
npm install
```

## Quick Start

```bash
# Browse YouTube (default)
pixeltube

# Play a local file
pixeltube video.mp4

# Play a YouTube URL
pixeltube https://youtu.be/dQw4w9WgXcQ

# Play a playlist URL
pixeltube 'https://www.youtube.com/playlist?list=PLrAXtmErZgOe...'
```

## Commands

| Command               | Description                        |
| --------------------- | ---------------------------------- |
| `pixeltube`           | Launch browse mode (default)       |
| `pixeltube <file>`    | Play a local video file            |
| `pixeltube <url>`     | Stream a YouTube video or playlist |
| `pixeltube browse`    | Browse YouTube interactively       |
| `pixeltube login`     | Check YouTube authentication       |
| `pixeltube help`      | Show full documentation            |
| `pixeltube --version` | Print version and exit             |

## Options

```
--fps, -f N        Override framerate
--width, -w N      Override pixel width
--scale, -s N      Scale factor (0.5 = chunky, 1.0 = fill terminal)
--dl               Download video first (slower but reliable)
--no-audio         Disable audio playback
--browser NAME     Read cookies from a specific browser
                   (chrome | chromium | brave | edge | firefox)
--cookies FILE     Use an exported cookies.txt file instead of a browser
--version, -V      Print version and exit
```

## Player Controls

| Key            | Action           |
| -------------- | ---------------- |
| `Space`        | Pause / Play     |
| `R`            | Rewind 10s       |
| `F`            | Forward 10s      |
| `N`            | Next track       |
| `P`            | Previous track   |
| `M`            | Mute / Unmute    |
| `S`            | Toggle subtitles |
| `Q`            | Quit             |
| `Esc` / `Left` | Back to browse   |

All player controls are case-insensitive.

## Browse Navigation

| Key               | Action                                       |
| ----------------- | -------------------------------------------- |
| `Up` / `Down`     | Navigate list                                |
| `Enter` / `Right` | Select (plays video, opens playlist/channel) |
| `Esc` / `Left`    | Go back                                      |
| `Tab`             | Search filters (sort, duration, type)        |
| `Q`               | Quit                                         |

## Authentication

**Search and public playback work without logging in.** If no browser cookies are available, pixeltube falls back to a search-only mode automatically.

To access your recommendations, subscriptions, playlists, and history, pixeltube reads cookies from a locally installed browser. No API keys needed.

By default pixeltube auto-detects the first installed browser in this order:

```
chrome → chromium → brave → edge → firefox
```

```bash
# Auto-detect (default)
pixeltube login

# Pick a specific browser
pixeltube login --browser firefox
pixeltube browse --browser chromium

# Use an exported cookies.txt file
pixeltube login --cookies ~/cookies.txt
```

> **Notes:**
> - **Linux + Chromium-family** (chrome, chromium, brave, edge): pixeltube extracts cookies directly from the browser's SQLite DB and gnome-keyring, so the browser can stay open. Requires `secret-tool` (libsecret) and `sqlite3` to be on PATH (both are usually pre-installed).
> - **macOS / Windows / Firefox**: pixeltube delegates to yt-dlp's `--cookies-from-browser`. On macOS you may be prompted for your Keychain password. On Windows the browser must be fully closed.

### Troubleshooting

If login fails, run `pixeltube login` to see the actual error. Common Linux issues:

- gnome-keyring (or your distro's secret service) must be running and unlocked.
- Browsers installed via Snap/Flatpak use sandboxed paths/keyrings — install the native package or use `--browser firefox` / `--cookies FILE` instead.
- Pass `--browser NAME` to skip auto-detection when you have multiple browsers installed.
- For Chromium profiles other than `Default`, use `--browser chromium:ProfileName`.
- Last-resort fallback: export cookies with a "Get cookies.txt" browser extension and pass `--cookies FILE`.

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
