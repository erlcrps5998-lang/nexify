# Nexify — ER:LC Community Management

Multi-tenant Next.js starter built for Vercel with Discord OAuth and PostgreSQL/Prisma.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in values.
3. Add a PostgreSQL database (e.g. Neon) and set `DATABASE_URL`.
4. Run `npx prisma db push` to create tables.
5. Set Discord OAuth2 redirect URL `http://localhost:3000/api/auth/callback/discord` in Discord Developer Portal.
6. `npm run dev`.

## Deploy
Deploy to Vercel as a Next.js project, adding `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL=https://YOURDOMAIN`, `DISCORD_CLIENT_ID`, and `DISCORD_CLIENT_SECRET` as environment variables. Add `https://YOURDOMAIN/api/auth/callback/discord` to Discord OAuth redirects. Run `npx prisma db push` against your production database once before creating communities.

## Security
Community creation requires an authenticated Discord session. A user is added to a community as `OWNER` at creation. All future community-scoped routes should authorize membership and role server-side; never trust community IDs or role labels sent by the browser. ER:LC API keys must remain server-side and encrypted at rest. There is no ER:LC API connection or active moderation command in this starter.

## Version 0.1
Public landing, dashboard preview, Discord OAuth (once configured), multi-tenant community CRUD (create/list), initial roles, and moderation schema. Staff, shifts, moderation, application modules are planned and not active yet.
