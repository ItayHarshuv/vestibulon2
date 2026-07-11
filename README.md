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

## Local development (without Docker)

If you prefer to run everything on your machine:

1) Create `.env` from `.env.example` and ensure `DATABASE_URL` points to a reachable Postgres (example uses `localhost:5432`).\n+2) Start a local Postgres (or use `./start-database.sh`).\n+3) Run `npm install` then `npm run dev`.


##general todos
[ ] review notification + monitoring
[ ] add app usage time, notification sent, review times of practice data
[ ] make unique keys for the exercise instead of key by name
[ ] figure what to do on days where the treatment plan changed
[ ] 

##database refactoring task
### deletion:
Whole table:
[ ] prescribed_exercise
[ ] prescribed_exercise_history
[ ] today_reps
[ ] user_session_history

columns:
[ ] treatment_plans.effective_from or created at (need to consolt what should stay)
[ ] users.number_of_sessions
[ ] today_schedule_source_date_key (not sure even what that is)

### changes
[ ] performed_reps.treatment_plan_exercise_id to reference to the treatment_plans table instead of prescribed_exercise.
 
