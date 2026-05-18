# pi-hindsight-stats

[![npm version](https://img.shields.io/npm/v/pi-hindsight-stats?style=flat-square)](https://www.npmjs.com/package/pi-hindsight-stats)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

**Hindsight memory analytics for Pi agent sessions** — fetches tags, entities, entity-graph hotspots, and mental models from [Hindsight](https://github.com/buihongduc132/hindsight-pi-local) banks and renders a compact project-insight cover.

Injected into Pi agent context on session start (async, non-blocking) or queried on-demand via CLI and slash commands.

## Features

- **Tag analytics** — top tags with level-grouping and ranking
- **Entity tracking** — most-mentioned named entities with mention counts
- **Graph visualization** — hotspot chains from entity relationship graph
- **Mental models** — active mental model summaries
- **TTL-based disk cache** — avoids redundant API calls with configurable TTL
- **Token-budgeted rendering** — respects configurable max token budget for context injection
- **Non-blocking injection** — async fire-and-forget on `session_start`, never blocks Pi workflow
- **Configurable steps** — enable/disable individual stat sections independently

## Example Output

```text
[Top Tags]
- repo:vendor-omo (182)
- topic:auth (91)

[Top Entities]
- Stripe (31)
- AuthService (28)

[Hotspots]
- AuthService ↔ Stripe ↔ SessionToken

[Top Mental Models]
- active-project-goals
- coding-constraints
```

## Installation

### For Humans

```bash
npm install pi-hindsight-stats
```

### For AI Agents

Add to your Pi `settings.json` packages array:

```json
{
  "packages": [
    "pi-hindsight-stats"
  ]
}
```

### For pi git-sourced

Add the git URL to your Pi `settings.json` packages array:

```json
{
  "packages": [
    "https://github.com/buihongduc132/pi-hindsight-stats"
  ]
}
```

Or local path for development:

```json
{
  "packages": [
    "/path/to/pi-hindsight-stats"
  ]
}
```

## Prerequisites

- A running [Hindsight](https://github.com/buihongduc132/hindsight-pi-local) server
- Pi CLI agent (`@mariozechner/pi-coding-agent`)

## Configuration

Create `~/.hindsight/stats-config.json`:

```json
{
  "enabled": true,
  "baseUrl": "http://localhost:8888",
  "bankId": "my-bank",
  "injectOnSessionStart": true,
  "cache": {
    "dir": "~/.hindsight/cache/stats",
    "ttlSeconds": 600
  },
  "steps": {
    "topTags": { "enabled": true, "limit": 5, "maxTokens": 120, "level": 2 },
    "topEntities": { "enabled": true, "limit": 5, "maxTokens": 120 },
    "hotspots": { "enabled": true, "limit": 5, "maxTokens": 160, "level": 2 },
    "topMentalModels": { "enabled": true, "limit": 5, "maxTokens": 120 }
  },
  "render": {
    "totalMaxTokens": 420,
    "compact": true
  }
}
```

### Config precedence

```
env vars (HINDSIGHT_BASE_URL, HINDSIGHT_API_KEY, HINDSIGHT_BANK_ID)
  > ~/.hindsight/stats-config.json
  > defaults
```

### Step options

| Step | Config key | Description |
|------|-----------|-------------|
| Top Tags | `topTags` | Most frequent tags across all facts |
| Top Entities | `topEntities` | Most mentioned named entities |
| Hotspots | `hotspots` | Highly connected entity clusters from the entity graph |
| Top Mental Models | `topMentalModels` | Active mental model summaries |

Each step supports: `enabled`, `limit`, `maxTokens`, and optional `level` (graph traversal depth).

## Usage

### Pi Extension (automatic)

When installed as a Pi package, the extension auto-registers hooks and commands:

- **Session start** — if `injectOnSessionStart` is `true`, fetches and injects a stats cover into context (non-blocking)
- **`hindsight-stats:cover`** — show stats cover on demand via Pi slash command
- **`hindsight-stats:cache-clear`** — clear the stats cache via Pi slash command

### CLI

```bash
# Full cover report
npx hindsight-stats cover

# Individual sections
npx hindsight-stats top-tags --limit 10
npx hindsight-stats top-entities --limit 10
npx hindsight-stats hotspots --limit 5
npx hindsight-stats top-mental-models --limit 5

# Cache management
npx hindsight-stats cache-clear

# Diagnostics
npx hindsight-stats doctor
```

## Architecture

```
src/
├── index.ts    # Pi extension — session_start hook, async injection
├── client.ts   # Hindsight REST API client (tags, entities, mental models)
├── config.ts   # Config resolution with file/env/defaults
├── cache.ts    # TTL-based disk cache
└── steps.ts    # Individual stat extraction + rendering
cli/
└── index.ts    # Standalone CLI entry point
tests/          # Vitest test suite
```

## Development

```bash
npm install
npm run typecheck
npm test
```

## License

MIT © 2025 [buihongduc132](https://github.com/buihongduc132)
