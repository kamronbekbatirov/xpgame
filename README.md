# XPGame — A Personal-Growth Coach in Your Pocket

A Telegram mini-app and bot that turns personal development into a single-player RPG. Set goals, get an AI-generated roadmap from GPT-5, complete tasks, level up, unlock achievements, spend XP in a custom shop, and stay motivated by an OpenAI-powered coach that constantly reshapes your plan based on what you actually do.

[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Node](https://img.shields.io/badge/Node-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![OpenAI](https://img.shields.io/badge/OpenAI-Responses%20API-412991?style=flat-square&logo=openai)](https://platform.openai.com)

## Why

Most habit and productivity apps treat self-improvement as a static checklist. XPGame treats it as a single-player RPG. Every meaningful action awards XP. Levels unlock new mechanics — custom rewards, shop items, AI Q&A. The coach behind the scenes constantly reshapes your roadmap based on what you actually do, not what you planned to do six weeks ago.

## What it does

### AI coaching (`server/openai-service.js`)
- **Goal & weakness analysis.** Drop in raw thoughts, the coach returns a structured map of objectives plus the friction stopping you from reaching them.
- **Personalised roadmaps.** GPT-5 generates concrete, time-boxed tasks calibrated to your level (`POST /api/generate-plan`).
- **Conversational continuity.** Every chat thread persists through the OpenAI Responses API (`response_id` stored in `chat` rows), so the coach remembers context across sessions.
- **Motivational messages** based on your real progress, cached in `personal_rewards_cache` to keep token spend low.
- **Auto-replanning** when you complete or stall on tasks (`POST /api/update-plan`).
- **Onboarding chat** — guided initial conversation that converts `/start` into a populated profile.

### Gamification (`server/gamification.js`)
A single class encodes the whole game economy:

```js
calculateXP(difficulty)   // easy = 15, medium = 35, hard = 75
calculateLevel(totalXP)   // floor(sqrt(totalXP / 100)) + 1
getXPForNextLevel(level)  // level^2 * 100
getLevelProgress(...)     // returns { current, total, percentage }
```

- **Achievements** that unlock based on combinations of actions.
- **XP history** (`xp_history` table) — every grant, deduction, and reason is auditable.
- **Custom shop** — design your own rewards with XP costs, "buy" them when you can afford it.
  - **Boosters** — temporary XP multipliers (`xp_multiplier`)
  - **Rewards** — one-shot or duration-based perks (`custom_reward`)
- **Active boosters** track timed effects per user.
- **Reward duration** — some rewards are one-shot, others persist for a configurable window.

### Productivity
- **Goals** with priority (1–5) and category.
- **Roadmap tasks** with dependencies and refresh tracking.
- **Manual tasks** for things the coach didn't suggest.
- **Today view** that surfaces what's due now.
- **Budget tracker** — separate XP-economy view of your real-world spending.
- **Leaderboard** — friendly competition across users on the same instance.

## Architecture

```
┌─────────────────────────┐         ┌───────────────────────────────┐
│  Telegram WebApp        │  HTTPS  │  Express server                │
│  (React + Vite)         │ ───────▶│  (server/index.js, port 3007)  │
│                         │         │  ┌─────────────────────────┐   │
│  17 React components    │◀─────── │  │ • Telegram bot (grammy) │   │
│  in /src/components     │         │  │ • OpenAI Responses API  │   │
└─────────────────────────┘         │  │ • PostgreSQL pool       │   │
                                    │  │ • 26 REST endpoints     │   │
                                    │  └─────────────────────────┘   │
                                    └───────────────┬───────────────┘
                                                    │
                                                    ▼
                                          ┌────────────────────┐
                                          │  PostgreSQL        │
                                          │  8 base + 3 shop   │
                                          │  tables            │
                                          └────────────────────┘
```

## What's in the repository

### Frontend — `/src`
React 18 + Vite 7 mini-app, designed to render inside Telegram's WebApp container with `tg.initData` as the authentication primitive. Components:

| Component | Purpose |
| --- | --- |
| `Dashboard.tsx` | Home screen — XP, level, progress bar, quick actions |
| `Today.tsx` | Today's tasks |
| `Tasks.tsx`, `TaskFeedback.tsx` | Full task list, feedback after completion |
| `Goals.tsx`, `GoalChat.tsx` | Goal creation, AI chat per goal |
| `OnboardingChat.tsx`, `OnboardingEnhanced.tsx` | Initial setup flow |
| `Profile.tsx`, `Me.tsx` | User profile, stats |
| `Achievements.tsx` | Unlocked badges |
| `Shop.tsx` | Spend XP on rewards & boosters |
| `Leaderboard.tsx` | Cross-user XP ranking |
| `Budget.tsx` | Real-world budget tracker |
| `UnifiedChat.tsx` | One conversational surface for the coach |
| `CountdownTimer.tsx` | Timer for active boosters / time-boxed tasks |
| `Login.tsx` | Web-fallback login |

### Backend — `/server`

```
server/
├── index.js              Express bootstrap, 26 REST endpoints
├── bot.js                grammy bot: /start, /stats, /help, web_app_data
├── database.js           pg pool + query helpers
├── models.js             Users, Tasks, Achievements, XPHistory wrappers
├── gamification.js       The XP + level economy
├── openai-service.js     OpenAI Responses API client (plan, motivation, chat)
├── shop.js               Shop catalog + purchase flow
├── timer-checker.js      Background sweeper for expired boosters
├── routes/
│   ├── auth.js           Telegram WebApp initData verification
│   ├── budget.js         Real-world budget endpoints
│   ├── onboarding.js     Onboarding flow API
│   ├── goal-chat.js      Per-goal AI chat
│   ├── shop.js           Shop catalog, purchases, active items
│   └── unified-chat.js   Single chat surface for the coach
├── schema.sql            Initial schema: users, goals, weaknesses, tasks,
│                         achievements, user_achievements, conversations,
│                         xp_history
├── migrations/           12 forward-only migrations
└── init-database.js      Helper: run schema + all migrations
```

### Database — base schema (`server/schema.sql`)
- `users` — telegram_id, username, total_xp, current_level, streaks
- `goals` — title, category, priority (1-5), status
- `weaknesses` — what you want to work on
- `tasks` — generated or manual, with difficulty + XP reward
- `achievements`, `user_achievements` — catalog + unlock log
- `conversations` — OpenAI thread pointers (`response_id`)
- `xp_history` — full audit trail of XP changes

### Migrations
Twelve forward-only migrations track the evolution of the platform:

```
add_auth_and_onboarding.sql      Auth + onboarding chat persistence
add_available_xp.sql             Spendable XP separate from total
add_budget_tracker.sql           Real-world budget tables
add_goal_chat.sql                Per-goal chat threads
add_goals_auto_generate.sql      Track auto-generated vs manual goals
add_motivation_cache.sql         Daily motivation messages cache
add_personal_rewards_cache.sql   Cache rendered rewards
add_response_id_to_chat.sql      Persist OpenAI Responses API pointers
add_reward_duration.sql          Rewards with configurable duration
add_roadmap_tasks.sql            Task → goal/roadmap linkage
add_shop_tables.sql              shop_items, user_purchases, user_active_boosters
add_task_refresh_tracker.sql     Track when tasks were last refreshed
```

## Getting started

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- An OpenAI API key

### 1. Database

```bash
createdb xpgame_db
cd server
node init-database.js          # runs schema.sql then every migration in order
```

### 2. Backend

```bash
cd server
cp .env.example .env
# fill in TELEGRAM_BOT_TOKEN, WEBAPP_URL, OPENAI_API_KEY, DB_*
npm install
npm start                       # nodemon: npm run dev
```

The Express server listens on `PORT` (default 3007) and registers the bot's webhook at `WEBAPP_URL`.

### 3. Frontend

```bash
# at the repository root
npm install
npm run dev                     # Vite dev server on http://localhost:5173
# or
npm run build                   # produces /dist for production
```

In production the `dist/` folder is served as static assets behind Caddy at the same origin as the API.

## Configuration reference

See [`server/.env.example`](server/.env.example) for the canonical list:

- `TELEGRAM_BOT_TOKEN` + `WEBAPP_URL` — required for the bot and the WebApp button.
- `OPENAI_API_KEY` — required for every AI feature; without it, the manual gameplay loop still works.
- `OPENAI_PLAN_MODEL` — model to use for plan generation. Defaults to `gpt-5`.
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — PostgreSQL connection.
- `PORT`, `NODE_ENV`.

## Operational scripts

The `server/` directory ships a handful of one-shot maintenance scripts that you may need at some point:

```
init-database.js          Bootstrap a fresh DB
apply-shop-migration.js   Apply just the shop schema
check-shop-items.js       List current shop catalog
check-tables.js           Sanity-check that all tables exist
clean-duplicates.js       Dedupe tasks/goals
clear-rewards.js          Wipe shop_items and purchases
clear-users.js            Nuke all users (dev only!)
run-migration.js          Re-run the migration runner
```

These exist as plain Node scripts — `node check-tables.js` is the entire interface.

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
