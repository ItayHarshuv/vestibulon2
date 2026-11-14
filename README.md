# vestibulon2

## Local development (Docker + Postgres)

This repo uses a PostgreSQL database (`DATABASE_URL`) with Drizzle, and local development runs the API via Vite middleware under `/api/*`.

### Prereqs

- Docker Desktop (or Docker Engine) with `docker compose`
- Node + npm (only needed if you want to run commands on the host instead of inside Docker)

### 1) Create your env file

Copy the example env file and edit as needed:

```bash
cp .env.example .env
```

Notes:
- For Docker dev, `docker-compose.yml` overrides `DATABASE_URL` inside the app container to use the `db` service.
- If you use WorkOS-authenticated flows, you must also set `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, and `WORKOS_COOKIE_PASSWORD` in `.env`.
- By default the database is **not** exposed to your host on port 5432 (to avoid port conflicts). It’s only reachable from other Docker services.

### 2) Start the stack

```bash
docker compose up --build
```

Then open `http://localhost:5173`.

### 3) Initialize the database schema

In another terminal:

```bash
npm run docker:db:migrate
```

Alternatively (no migrations, just push schema):

```bash
npm run docker:db:push
```

### Useful commands

- Logs: `npm run docker:logs`
- Stop: `npm run docker:down`

## Web Push notifications

Web Push requires HTTPS in production (localhost is allowed for development).
Generate VAPID keys once, then configure `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `CRON_SECRET` as shown in
`.env.example`. Apply the latest database migration before enabling
notifications.

The Vercel cron in `vercel.json` checks for due reminders every minute. This
frequency requires a Vercel plan that supports per-minute cron jobs. If the
deployment uses a different scheduler, call `GET /api/cron/push-reminders`
every minute with `Authorization: Bearer <CRON_SECRET>`.

## Local development (without Docker)

If you prefer to run everything on your machine:

1) Create `.env` from `.env.example` and ensure `DATABASE_URL` points to a reachable Postgres (example uses `localhost:5432`).\n+2) Start a local Postgres (or use `./start-database.sh`).\n+3) Run `npm install` then `npm run dev`.

