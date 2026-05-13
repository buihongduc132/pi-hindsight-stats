# pi-hindsight-stats

Compact project-insight cover for engineering work, backed by [Hindsight](https://github.com/vectorize-io/hindsight) REST APIs.

Fetches stats from Hindsight banks and renders a concise runtime cover showing top tags, entities, hotspots, and mental models — injected into Pi agent context on session start.

## Features

- **Pi extension** — async injection on `session_start`, non-blocking
- **CLI** — `hindsight-stats cover`, `hindsight-stats top-tags`, etc.
- **Cached** — configurable TTL-based disk cache to avoid redundant API calls
- **Configurable steps** — enable/disable individual stat sections (tags, entities, hotspots, mental models)
- **Token-budgeted** — respects total max token budget for context injection

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

## Install

```bash
# In Pi settings.json packages array:
"https://github.com/buihongduc132/pi-hindsight-stats"
```

Or local path:

```bash
"/path/to/pi-hindsight-stats"
```

## Prerequisites

- A running Hindsight server
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

## CLI Usage

```bash
# Full cover report
npx tsx cli/index.ts cover

# Individual sections
npx tsx cli/index.ts top-tags --limit 10
npx tsx cli/index.ts top-entities --limit 10
npx tsx cli/index.ts hotspots --limit 5
npx tsx cli/index.ts top-mental-models --limit 5
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
npm test
npm run typecheck
```

## License

MIT © 2025 buihongduc132
