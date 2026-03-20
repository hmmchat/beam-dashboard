# Beam Dashboard

Sales team content management dashboard for Beam. Manage users, interests, values, brands, icebreakers, dares, loading memes, and gifts.

## Setup

1. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

2. Configure environment variables:

   - `ALLOWED_EMAILS` – Comma-separated list of emails allowed to log in (e.g. `alice@beam.place,bob@beam.place`)
   - `GOOGLE_CLIENT_ID` – Google OAuth client id
   - `GOOGLE_CLIENT_SECRET` – Google OAuth client secret
   - `NEXT_PUBLIC_API_URL` – **API gateway** base URL (e.g. `http://localhost:3000` for local dev), **not** the dashboard URL
   - `NEXT_PUBLIC_ADMIN_USERS_PATH` (optional) – Defaults to `/v1/admin/users`. Set if your gateway mounts admin user APIs elsewhere (requires rebuild for production)
   - `NEXTAUTH_SECRET` – Random string for session encryption (e.g. `openssl rand -base64 32`)
   - `NEXTAUTH_URL` – Dashboard URL (e.g. `http://localhost:3020` for local dev)

3. Install dependencies and run:

   ```bash
   npm install
   npm run dev
   ```

4. Open `http://localhost:3020` (or your `NEXTAUTH_URL`) and sign in with a whitelisted Google account.

## Backend Prerequisites

The backend API gateway must route admin endpoints:

- `/v1/admin/users` (list + moderation actions) — `GET` (list), optional `GET /v1/admin/users/:id` (full user + nested profiles/photos for the dashboard profile panel), `PATCH /:id`, `POST .../ban`, `POST .../unban`, `POST .../report`, `DELETE`, `DELETE .../hard` → user-service
- `/v1/admin/interests`, `/v1/admin/values`, `/v1/admin/brands` → user-service
- `/v1/admin/gifts` → friend-service
- `/v1/streaming/admin/*` → streaming-service

Add `http://localhost:3020` (and `https://dashboard.beam.place` in production) to `ALLOWED_ORIGINS` in the API gateway.

### Users page: `No route found for: /v1/admin/users`

That message comes from the **API gateway** (or any server you pointed at with `NEXT_PUBLIC_API_URL`): nothing is registered for `GET /v1/admin/users` yet.

1. **Confirm `NEXT_PUBLIC_API_URL`** — It must be your **API** host (e.g. `https://api.beam.place`), not the dashboard. For the Docker image, this value is set at **build time** (GitHub Actions secret `NEXT_PUBLIC_API_URL`). If it equals the dashboard origin, the browser calls the wrong host.

2. **Implement the route** — Register the user admin routes on the gateway and implement them in **user-service** (see the list under [Backend Prerequisites](#backend-prerequisites)).

3. **Optional path override** — If your gateway uses a different path than `/v1/admin/users`, set `NEXT_PUBLIC_ADMIN_USERS_PATH` when building the dashboard image and redeploy.

For image uploads larger than default limits, set request body limits to at least `50MB` on the API path:

- Nginx (or reverse proxy in front of API gateway): `client_max_body_size 50M;`
- API gateway/backend upload middleware: multipart/body limit `50mb`

## Deployment (Image-based, same as backend flow)

This repo publishes a Docker image to GHCR via `.github/workflows/deploy.yml`.

- Image naming pattern: `ghcr.io/<owner>/<repo>-dashboard:<tag>`
- Common tags from the workflow:
  - `latest` (default branch)
  - `main`
  - `main-<short-sha>`

Use `docker-compose.yml` in this repo and deploy like backend:

```bash
cd /opt/beam-dashboard
# update the image tag and environment values in docker-compose.yml
docker compose pull
docker compose up -d
docker compose ps
docker logs --tail=100 beam-dashboard
```

Keep dashboard on `127.0.0.1:3020` and expose it through Nginx as `https://dashboard.beam.place`.

## Content Sections

| Section        | Description                    |
|----------------|--------------------------------|
| Users          | User accounts & admin actions  |
| Icebreakers    | Questions shown during calls   |
| Dares          | Dare catalog for calls         |
| Loading Memes  | Memes shown while waiting      |
| Interests      | User interests catalog         |
| Values         | Causes / what matters to users  |
| Brands         | Brand catalog with logos       |
| Gifts          | Chat gifts and stickers        |
