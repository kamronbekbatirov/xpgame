# XPGame — A Personal-Growth Coach in Your Pocket

A Telegram mini-app and bot that turns personal development into a game. Set goals, get an AI-generated roadmap from GPT-5, complete tasks, level up, unlock rewards from a custom shop, and stay motivated with proactive nudges from your coach.

[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Node](https://img.shields.io/badge/Node-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![OpenAI](https://img.shields.io/badge/OpenAI-Responses%20API-412991?style=flat-square&logo=openai)](https://platform.openai.com)

## Why

Most habit and productivity apps treat self-improvement as a checklist. XPGame treats it as a single-player RPG: every meaningful action awards XP, levels unlock new mechanics (custom rewards, deeper insights from the coach, longer-running plans), and the AI coach behind the scenes constantly reshapes your roadmap based on what you actually do — not what you planned to do six weeks ago.

## What it does

### AI coaching
- **Goal & weakness analysis** — paste raw thoughts, get a structured map of objectives and the friction stopping you from reaching them.
- **Personalised roadmaps** — GPT-5 generates concrete, time-boxed tasks calibrated to your level.
- **Conversational continuity** — every chat thread persists through the OpenAI Responses API, so the coach remembers context across sessions.
- **Motivational messages** based on your real progress, cached to keep token spend low.
- **Auto-replanning** when you complete or stall on tasks.

### Gamification
- **XP and levels** with sensible exponential curves.
- **Achievements** that unlock based on combinations of actions.
- **Custom shop** — design your own rewards, set their XP cost, and "buy" them when you have the points.
- **Reward duration** — some rewards are one-shot, others persist for a configurable time window.
- **Budget tracker** — separate XP-economy view of your real-world spending.

### Productivity
- **Goals** with priority (1–5) and category.
- **Roadmap tasks** with dependencies and refresh tracking.
- **Manual tasks** for things the coach didn't suggest.
- **Personal rewards cache** so the shop loads instantly.

## Architecture

```
┌─────────────────────────┐         ┌─────────────────────────┐
│  Telegram WebApp        │  HTTPS  │  Express server         │
│  (React + Vite, /src)   │ ───────▶│  (server/index.js)      │
│  Renders inside         │         │  • Telegram bot (grammy)│
│  Telegram clients       │◀─────── │  • OpenAI Responses API │
└─────────────────────────┘         │  • PostgreSQL pool      │
                                    └────────────┬────────────┘
                                                 │
                                                 ▼
                                       ┌──────────────────┐
                                       │  PostgreSQL      │
                                       └──────────────────┘
```

- **Frontend** (`/src`, `/index.html`, `/dist`) — Vite + React 18 mini-app served as a static bundle from `dist/`. Designed to render inside Telegram's WebApp container with `tg.initData` as the authentication primitive.
- **Backend** (`/server`) — Node 20 + Express, with `grammy` driving the bot, `openai` driving the coach, and `pg` driving the database. Exposes a small JSON API consumed by the frontend.

## Getting started

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- An OpenAI API key

### 1. Database

```bash
createdb xpgame_db
psql xpgame_db -f server/schema.sql
# apply each migration in alphabetical order:
ls server/migrations/*.sql | xargs -I{} psql xpgame_db -f {}
```

Or use the helper script:

```bash
cd server
node init-database.js
```

### 2. Backend

```bash
cd server
cp .env.example .env
# fill in TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, DB_*, WEBAPP_URL
npm install
npm start          # or: npm run dev (with nodemon)
```

The Express server listens on `PORT` (default 3007) and auto-registers the bot's webhook to `WEBAPP_URL`.

### 3. Frontend

```bash
# at the repository root
npm install
npm run dev        # Vite dev server
# or:
npm run build      # produces /dist for production
```

In production the `dist/` folder is served as static assets behind Caddy at the same origin as the API.

## Project layout

```
.
├── index.html
├── src/                    # React mini-app source
├── dist/                   # Production bundle (vite build)
├── server/
│   ├── index.js            # Express + bot bootstrap
│   ├── bot.js              # Telegram command handlers
│   ├── database.js         # pg pool + query helpers
│   ├── gamification.js     # XP, levels, achievements
│   ├── openai-service.js   # Coach (OpenAI Responses API)
│   ├── schema.sql          # Initial database schema
│   └── migrations/         # Forward-only schema migrations
├── AI_COACHING_STANDARD.md # Internal spec for the coach prompts
└── DEBUGGING.md
```

## Configuration reference

See [`server/.env.example`](server/.env.example) for the canonical list. Highlights:

- `TELEGRAM_BOT_TOKEN` + `WEBAPP_URL` — required for the bot and the WebApp button.
- `OPENAI_API_KEY` — required for every AI feature; without it, the manual gameplay loop still works.
- `OPENAI_PLAN_MODEL` — model to use for plan generation. Defaults to `gpt-5`.
- `DB_*` — PostgreSQL connection parameters.

## Production

A reference Caddy snippet that serves the WebApp under `my-bots.uz/xpgame/` and the API under `my-bots.uz/xpgame/api/`:

```caddy
my-bots.uz {
    handle /xpgame/api/* {
        uri strip_prefix /xpgame
        reverse_proxy 127.0.0.1:3007
    }
    handle_path /xpgame* {
        root * /srv/xpgame/dist
        try_files {path} /index.html
        file_server
    }
}
```

## License

Released under the [MIT License](LICENSE).
