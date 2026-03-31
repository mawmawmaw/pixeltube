// Help and usage text output

export function printHelp(): void {
	console.log(`
  pixeltube — Play videos as colored pixel art in the terminal

  USAGE
    pixeltube <video-file-or-url> [options]    Play a video
    pixeltube browse                           Browse YouTube interactively
    pixeltube login                            Check YouTube auth & launch browse
    pixeltube help                             Show this help

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
    --cookies FILE   Use a cookies.txt file instead of Chrome browser cookies
                     Avoids macOS Keychain password prompts

  BROWSE MODE
    Interactive TUI to browse your YouTube account:
      - Playlists     List and browse your saved playlists
      - Subscriptions Recent videos from your subscribed channels
      - Search        Search YouTube by keyword
    Navigate with arrow keys, Enter/Right to select, ESC/Left to go back.
    ESC during video playback returns to the browse list.

  AUTHENTICATION
    Two ways to authenticate with YouTube:

    1. Browser cookies (default):
       Reads cookies directly from Chrome. macOS will prompt for your
       Keychain password — this is the system "security" tool accessing
       Chrome's encrypted cookie store. Requires Chrome to be fully closed.
         pixeltube login
         pixeltube browse

    2. Cookies file (no Keychain access):
       Export cookies using a browser extension (e.g. "Get cookies.txt"),
       then pass the file path with --cookies:
         pixeltube login --cookies ~/cookies.txt
         pixeltube browse --cookies ~/cookies.txt

  EXAMPLES
    pixeltube video.mp4                      Play a local file
    pixeltube video.mp4 --scale 0.5          Play at half resolution (chunky mode)
    pixeltube https://youtu.be/dQw4w9WgXcQ   Stream from YouTube
    pixeltube browse                          Browse and pick a video
    pixeltube browse --cookies ~/cookies.txt  Browse using exported cookies file

  REQUIREMENTS
    ffmpeg    brew install ffmpeg
    yt-dlp    brew install yt-dlp    (for URLs and browse mode)

  Requires an interactive terminal (TTY).
`)
}

export function printUsage(): void {
	console.log(`Usage: pixeltube <video-file-or-url> [options]
       pixeltube browse | login | help

Run "pixeltube help" for full documentation.`)
}
