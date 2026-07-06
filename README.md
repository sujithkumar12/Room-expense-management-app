# RoomSplit — Room Expense Management App

Split shared expenses with roommates. Built with **Vite + React**, **Vercel Serverless API**, and **PostgreSQL** (Vercel Postgres / Neon).

## Features

- **Sign up & Login** — JWT-based authentication
- **Create or join rooms** — Share a 6-character invite code with roommates
- **Add expenses** — Amount, date, and **purpose** (required)
- **Room overview** — See all roommates' expenses, total spend, equal share, and balances
- **Dashboard** — Monthly bar chart, roommate pie chart, and yearly breakdown

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | Vite, React, TypeScript, Recharts   |
| Backend  | Vercel Serverless Functions         |
| Database | PostgreSQL via `@vercel/postgres`   |
| Auth     | bcrypt + JWT                        |

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

You need a Postgres database. Options:

- **Vercel Postgres (Neon)** — Create in [Vercel Dashboard](https://vercel.com/dashboard) → Storage → Create Database
- **Local Postgres** — Use any Postgres URL in `POSTGRES_URL`

### 3. Run the app

For full-stack local dev (API + frontend):

```bash
npx vercel dev
```

Or run frontend only (API calls need `vercel dev` on port 3000):

```bash
# Terminal 1
npx vercel dev

# Terminal 2
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Deploy to Vercel

1. Push this project to GitHub
2. Import in [Vercel](https://vercel.com/new)
3. Add **Postgres** storage from the Vercel dashboard (Storage → Create → Postgres)
4. Set environment variable:
   - `JWT_SECRET` — a long random string (e.g. `openssl rand -base64 32`)
5. Deploy — tables are created automatically on first API request

## Database Schema

Tables: `users`, `rooms`, `room_members`, `expenses`

Manual setup (optional): run `sql/schema.sql` in your Postgres console.

## API Routes

| Method | Route                    | Description              |
|--------|--------------------------|--------------------------|
| POST   | `/api/auth/signup`       | Create account           |
| POST   | `/api/auth/login`        | Sign in                  |
| GET    | `/api/rooms`             | List user's rooms        |
| POST   | `/api/rooms`             | Create room              |
| POST   | `/api/rooms/join`        | Join by invite code      |
| GET    | `/api/rooms/[id]`        | Room details + expenses  |
| POST   | `/api/expenses`          | Add expense              |
| GET    | `/api/dashboard/monthly` | Monthly chart data       |

## How equal share works

```
Equal share = Total room expenses ÷ Number of roommates
Your balance = What you paid − Equal share
```

Positive balance = others owe you. Negative = you owe others.
