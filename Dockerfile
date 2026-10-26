# Sahara OS — Dockerfile for Coolify / any generic Docker host.
#
# Both stages use the same Debian-based image so the native better-sqlite3
# addon compiled in the builder stage is ABI-compatible with the runtime
# stage (an Alpine/glibc mismatch is the #1 reason "works in build, crashes
# on start" happens with this dependency).
#
# IMPORTANT — persistent storage: this app stores its SQLite database at
# DATABASE_URL (defaults to ./dev.db, i.e. /app/dev.db in this image) and
# uploaded files under /app/public/uploads. Unless you mount a persistent
# volume over one of those paths and point DATABASE_URL at it, every
# redeploy/restart resets the app back to whatever's in the git-committed
# dev.db — the exact issue already solved for the Render deployment of this
# same app. See the deployment notes for the recommended volume + env var.

FROM node:20-bookworm-slim AS builder
WORKDIR /app

# python3/make/g++ are required to compile better-sqlite3's native addon.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Copied before `npm ci` (rather than just package*.json) so the postinstall
# hook (`prisma generate`, which needs prisma/schema.prisma) has everything
# it needs — this trades some Docker layer-caching efficiency for a build
# that just works.
COPY . .

RUN npm ci

# Public marketing IDs are inlined into the browser bundle at BUILD time
# (src/components/public/marketing-tags.tsx, app/book/page.tsx), so setting them
# only as runtime env vars has no effect. Declared here so a build-time variable
# of the same name reaches `next build` on any Docker host. ARG only (no ENV):
# unset stays genuinely unset, tags stay off, and nothing leaks into the runner
# stage. These are public IDs, never secrets.
ARG NEXT_PUBLIC_GA4_ID
ARG NEXT_PUBLIC_GOOGLE_ADS_ID
ARG NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL
ARG NEXT_PUBLIC_META_PIXEL_ID
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Business runs on India time — "today/tomorrow" everywhere depends on it.
ENV TZ=Asia/Kolkata

# tar is used by the built-in backup/restore API routes; ca-certificates for
# any outbound HTTPS calls (WhatsApp API, Google Drive backups, etc.).
RUN apt-get update \
    && apt-get install -y --no-install-recommends tar ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app ./

EXPOSE 3000

# Container health: /api/health answers 200 (ok / degraded) or 503 (unhealthy: database unreachable, event loop blocked for seconds, memory
# at the limit). Coolify restarts an unhealthy container (restart policy "unless-stopped"). The first 90 s are a grace period for
# db-setup and startup; three failed probes in a row are needed before the container counts as unhealthy.
HEALTHCHECK --interval=60s --timeout=10s --start-period=90s --retries=3   CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/render-start.mjs"]
