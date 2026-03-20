# Beam Dashboard

Sales team content management dashboard for Beam. Manage interests, values, brands, icebreakers, dares, loading memes, and gifts.

## Setup

1. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

2. Configure environment variables:

   - `ALLOWED_EMAILS` – Comma-separated list of emails allowed to log in (e.g. `alice@beam.place,bob@beam.place`)
   - `GOOGLE_CLIENT_ID` – Google OAuth client id
   - `GOOGLE_CLIENT_SECRET` – Google OAuth client secret
   - `NEXT_PUBLIC_API_URL` – Backend API gateway URL (e.g. `http://localhost:3000` for local dev)
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

- `/v1/admin/interests`, `/v1/admin/values`, `/v1/admin/brands` → user-service
- `/v1/admin/gifts` → friend-service
- `/v1/streaming/admin/*` → streaming-service

Add `http://localhost:3020` (and `https://dashboard.beam.place` in production) to `ALLOWED_ORIGINS` in the API gateway.

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
| Icebreakers    | Questions shown during calls   |
| Dares          | Dare catalog for calls         |
| Loading Memes  | Memes shown while waiting      |
| Interests      | User interests catalog         |
| Values         | Causes / what matters to users  |
| Brands         | Brand catalog with logos       |
| Gifts          | Chat gifts and stickers        |
