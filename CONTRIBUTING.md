# Contributing to PixelTube

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/mawmawmaw/pixeltube.git
cd pixeltube
npm install
```

### Requirements

- Node.js 18+
- FFmpeg (`brew install ffmpeg`)
- yt-dlp (`brew install yt-dlp`)

## Code Style

- **Tabs** for indentation (not spaces)
- **No semicolons**
- **Double quotes** for strings
- Max line width: 120 characters

Formatting is enforced by [Biome](https://biomejs.dev). Run before committing:

```bash
npm run format
```

## Workflow

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run checks: `npm run check`
5. Commit with a descriptive message (see conventions below)
6. Push and open a PR

## Commit Conventions

Use short, descriptive commit messages:

```
feat: add volume control to player
fix: resolve audio desync on pause/resume
refactor: extract subtitle parser to separate module
docs: update README with new controls
chore: update yt-dlp version requirement
```

Prefixes: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`

## Running Checks

```bash
npm test          # Run tests (vitest)
npm run lint      # Lint (oxlint)
npm run format    # Format (biome)
npm run check     # All of the above
```

All checks must pass before a PR will be reviewed.

## Project Structure

```
bin/pixeltube.js              CLI entry point
src/
  browse/
    browse.js           TUI browse mode (main menu, lists, navigation)
    data.js             YouTube data fetching via yt-dlp
  tui/
    terminal.js         Raw mode, key parsing, escape sequences
    screen.js           Title bar, status bar, spinners
    list-view.js        Scrollable list component
    theme.js            Theme detection, color system, terminal compat
  player.js             Video playback, controls, chrome overlay
  decoder.js            FFmpeg frame decoding, audio management
  renderer.js           ANSI half-block frame rendering with diffing
  resolve.js            URL resolution via yt-dlp
  probe.js              Video metadata via ffprobe
  login.js              YouTube authentication
test/                   Vitest test files
```

## Guidelines

- **No npm dependencies** — this project uses only Node.js built-ins. Keep it that way.
- **Keep it simple** — prefer readable code over clever abstractions.
- **Test what matters** — pure functions, data transformations, dimension calculations. Don't try to test TUI rendering.
- **Respect the theme system** — use `theme.*` from `src/tui/theme.js` for all colors. Never hardcode ANSI escape codes.
- **Terminal compat** — use the helpers in `terminal.js` (`syncStart`/`syncEnd`, `altScreen`). Don't write raw escape sequences for features that need compat guards.

## Reporting Bugs

Open an issue with:
- Terminal emulator + version (iTerm2, kitty, Terminal.app, etc.)
- Node.js version (`node --version`)
- OS and version
- Steps to reproduce
- Expected vs actual behavior

## Feature Requests

Open an issue describing:
- What you want to do
- Why it would be useful
- Any ideas on implementation

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
