# Actify

A team to-do list ("actionables"). React (Vite) + Express + PostgreSQL, with email/password signup and login.

## Quick start (no database install needed)

```bash
cd server && cp .env.example .env     # Windows: copy .env.example .env
```
Open `server/.env` and set `JWT_SECRET` to a long random string (leave `DATABASE_URL` empty):
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Then, from the project root:
```bash
npm run install:all
npm run dev:server    # terminal 1, API on :4000
npm run dev:client    # terminal 2, app on http://localhost:5173
```
With `DATABASE_URL` empty the server uses an embedded Postgres (PGlite): tables are created automatically and data is saved in `server/.pglite-data`. Delete that folder to start fresh.

Open http://localhost:5173 and sign up. It's a shared team board: everyone sees every actionable, but only the person who created one can edit or delete it. The owner it's assigned to can also update its status (e.g. mark it done).

## Use a real PostgreSQL instead

1. Create a database, e.g. `createdb actify` (or run Postgres in Docker).
2. Set `DATABASE_URL=postgres://postgres:postgres@localhost:5432/actify` in `server/.env`.
3. Run `npm run migrate` once, then start the server and client as above.

## Production (single server)

```bash
npm run install:all && npm run build && npm run migrate
NODE_ENV=production npm start
```
Express serves the built React app and the API from one origin. Serve it over HTTPS (the auth cookie is `Secure` in production). If your host needs SSL to Postgres, set `PGSSL=true`.

## Security built in

- Passwords hashed with bcrypt (cost 12); login timing is equalised for unknown emails
- Session in an **httpOnly, SameSite=Strict, Secure (prod)** JWT cookie, so JavaScript never sees the token
- CSRF defence: SameSite=Strict plus a required `X-Requested-With` header on every write
- Rate limiting: 120 req/min overall, 20 login/signup attempts per 15 min per IP
- `helmet` security headers incl. a Content-Security-Policy; `x-powered-by` removed
- All input validated with `zod`; all SQL parameterised; column names allow-listed
- 10 KB JSON body limit; generic error messages (no stack traces leak)
- Server refuses to start without a strong `JWT_SECRET`

## API

| Method | Path | Notes |
|---|---|---|
| POST | /api/auth/signup, /login, /logout | |
| GET | /api/auth/me | current user |
| GET | /api/users | owner dropdown |
| GET/POST | /api/actionables | |
| PATCH | /api/actionables/:id | creator can edit anything; the owner can change **status only**; others get 403 |
| DELETE | /api/actionables/:id | soft delete; **only the creator** (others get 403) |
| POST | /api/actionables/:id/restore | powers "Undo" (creator only, within 1 hour) |

## Ideas for later

Email verification, password reset, separate workspaces per team, and an `npm audit` in CI.
