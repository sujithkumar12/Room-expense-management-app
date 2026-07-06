# RoomSplit — Room Expense Management App

Split shared expenses with roommates. Built with **Vite + React**, **Vercel Serverless API**, and **Supabase PostgreSQL**.

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
| Database | PostgreSQL (Supabase) via `pg`           |
| Auth     | bcrypt + JWT                        |

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and add your **Supabase** credentials from:
**Supabase Dashboard → Project Settings → Database**

Required variables:

| Variable | Description |
|----------|-------------|
| `POSTGRES_URL` | Pooled connection (port 6543) |
| `POSTGRES_URL_NON_POOLING` | Direct connection (port 5432) — used for schema setup |
| `JWT_SECRET` | Long random string for app auth tokens |

### 3. Initialize database tables

```bash
npm run db:init
```

Tables are also created automatically on the first API request.

### 4. Run the app

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
3. In **Vercel → Settings → Environment Variables**, add from Supabase:
   - `POSTGRES_URL`
   - `POSTGRES_URL_NON_POOLING`
   - `POSTGRES_PRISMA_URL` (optional)
   - `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE` (optional)
   - `JWT_SECRET` — a long random string
4. Deploy — tables are created automatically on first API request

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
