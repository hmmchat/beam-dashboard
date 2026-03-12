# Beam Dashboard

Sales team content management dashboard for Beam. Manage interests, values, brands, icebreakers, dares, loading memes, and gifts.

## Setup

1. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

2. Configure environment variables:

   - `ALLOWED_EMAILS` – Comma-separated list of emails allowed to log in (e.g. `alice@beam.place,bob@beam.place`)
   - `DASHBOARD_PASSWORD` – Shared password for all whitelisted users
   - `NEXT_PUBLIC_API_URL` – Backend API gateway URL (e.g. `http://localhost:3000` for local dev)
   - `NEXTAUTH_SECRET` – Random string for session encryption (e.g. `openssl rand -base64 32`)
   - `NEXTAUTH_URL` – Dashboard URL (e.g. `http://localhost:3020` for local dev)

3. Install dependencies and run:

   ```bash
   npm install
   npm run dev
   ```

4. Open `http://localhost:3020` (or your `NEXTAUTH_URL`) and sign in with a whitelisted email and password.

## Backend Prerequisites

The backend API gateway must route admin endpoints:

- `/v1/admin/interests`, `/v1/admin/values`, `/v1/admin/brands` → user-service
- `/v1/admin/gifts` → friend-service
- `/v1/streaming/admin/*` → streaming-service

Add `http://localhost:3020` (and `https://dashboard.beam.place` in production) to `ALLOWED_ORIGINS` in the API gateway.

## Deployment

- **Hosting:** Vercel or Netlify
- **Domain:** `dashboard.beam.place` (add CNAME in DNS)
- **Env vars:** Set all variables from `.env.example` in your hosting provider.

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
