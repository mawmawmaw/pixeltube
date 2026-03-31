# PixelTube Improvement Review

## All Improvements — COMPLETED

### Quick Wins
- [x] Text sanitization for remote strings (`src/utils/sanitize.js`)
- [x] TTY guards and fallback sizing (`checkTTY()`, `isTTY` guards)
- [x] Global cleanup hooks (`uncaughtException`, `unhandledRejection`, `emergencyRestore`)
- [x] Unified time formatting (`src/utils/time.js`)
- [x] Validate `--cookies` file input
- [x] Warn on missing ffplay
- [x] maxBuffer consistency in `resolve.js`
- [x] Concurrency limit for playlist counts (batches of 5)
- [x] Temp file cleanup with `mkdtemp` + PID
- [x] Frame queue ring buffer (O(1) instead of O(n) shift)

### Architecture Splits
- [x] `bin/pixeltube.js` → 85 lines (was 425)
- [x] `src/cli/args.js` — arg parsing with tests
- [x] `src/cli/commands.js` — command handlers
- [x] `src/cli/help.js` — help text
- [x] `src/browse/browse.js` → 153 lines (was 727)
- [x] `src/browse/state.js` — state stack management
- [x] `src/browse/screens/main-menu.js` — logo + menu
- [x] `src/browse/screens/video-list.js` — shared list screen
- [x] `src/browse/screens/search.js` — search + filters
- [x] `src/player.js` → 286 lines (was 555)
- [x] `src/player/chrome.js` — player UI chrome (compact + full)
- [x] `src/player/subs.js` — subtitle download

### Infrastructure
- [x] yt-dlp client factory (`src/ytdlp.js`)
- [x] Terminal helpers centralized (`emergencyRestore`, `enterAltScreen`, `clearScreen`, etc.)
- [x] All inline escape sequences replaced with helpers

### Testing — 83 tests across 10 files
- [x] CLI arg parsing (15 tests)
- [x] SRT parsing + fixtures (9 tests)
- [x] Sanitize + edge cases (18 tests)
- [x] parseKey (13 tests)
- [x] Theme, renderer, decoder, time formatting

### Documentation
- [x] TTY requirement in README
- [x] Supported terminal emulators listed

## Performance Optimizations — COMPLETED

- [x] yt-dlp JSON parsing (`%()j` + `JSON.parse` — no more tab-splitting edge cases)
- [x] stdout backpressure (await `drain` instead of dropping frames)
- [x] Decoder frame buffer pooling (pre-allocated, zero per-frame allocation)
- [x] Rolling read buffer with offset tracking (compact only when half consumed)
