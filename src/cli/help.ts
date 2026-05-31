// Help and usage text output

import { VERSION } from "./update-check.js"

export function printHelp(): void {
	console.log(`
  pixeltube v${VERSION} — Play videos as colored pixel art in the terminal

  USAGE
    pixeltube <video-file-or-url> [options]    Play a video
    pixeltube browse                           Browse YouTube interactively
    pixeltube login                            Check YouTube auth & launch browse
    pixeltube help                             Show this help
    pixeltube --version                        Print version and exit

  PLAYBACK OPTIONS
    --fps, -f N      Override framerate
    --width, -w N    Override pixel width (in terminal columns)
    --scale, -s N    Scale factor for resolution
                       < 1.0  chunkier/more pixelated (e.g. 0.25, 0.5)
                       1.0    fill the terminal (default)
                       > 1.0  supersample (marginal benefit)
    --dl             Download video first instead of streaming
                     Slower startup but more reliable for some sources
    --no-audio       Disable audio playback

  AUTH OPTIONS
    --browser NAME   Read cookies from a specific browser
                     One of: chrome, chromium, brave, edge, firefox
    --cookies FILE   Use an exported cookies.txt file instead of a browser

  BROWSE MODE
    Interactive TUI to browse your YouTube account:
      - Playlists     List and browse your saved playlists
      - Subscriptions Recent videos from your subscribed channels
      - Search        Search YouTube by keyword (no auth required)
    Navigate with arrow keys, Enter/Right to select, ESC/Left to go back.
    ESC during video playback returns to the browse list.

  AUTHENTICATION
    Search and public video playback work without authentication.
    For subscriptions, recommendations, history, and your playlists,
    pixeltube reads cookies from a locally installed browser.

    Detection order (when --browser is not set):
      chrome → chromium → brave → edge → firefox

    1. Browser cookies (default):
       Auto-detects the first installed browser from the list above.
       Requires the browser to be fully closed so its cookie database
       can be read. On macOS you'll be prompted for your Keychain password.
         pixeltube login
         pixeltube browse
         pixeltube browse --browser firefox

    2. Cookies file (no browser access):
       Export cookies using a browser extension (e.g. "Get cookies.txt"),
       then pass the file path with --cookies:
         pixeltube login --cookies ~/cookies.txt
         pixeltube browse --cookies ~/cookies.txt

    If no supported browser is found, pixeltube falls back to a
    search-only mode (search and public video playback still work).

  EXAMPLES
    pixeltube video.mp4                       Play a local file
    pixeltube video.mp4 --scale 0.5           Play at half resolution (chunky mode)
    pixeltube https://youtu.be/dQw4w9WgXcQ    Stream from YouTube
    pixeltube browse                          Browse and pick a video
    pixeltube browse --browser firefox        Use Firefox cookies
    pixeltube browse --cookies ~/cookies.txt  Browse using exported cookies file

  REQUIREMENTS
    ffmpeg and yt-dlp must be on PATH.
      macOS:    brew install ffmpeg yt-dlp
      Debian:   sudo apt install ffmpeg yt-dlp
      Arch:     sudo pacman -S ffmpeg yt-dlp
      Fedora:   sudo dnf install ffmpeg yt-dlp
      Windows:  winget install ffmpeg yt-dlp

  Requires an interactive terminal (TTY).
`)
}

export function printUsage(): void {
	console.log(`Usage: pixeltube <video-file-or-url> [options]
       pixeltube browse | login | help

Run "pixeltube help" for full documentation.`)
}
