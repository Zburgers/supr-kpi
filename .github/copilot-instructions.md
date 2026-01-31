# Copilot instructions for KPI / Pegasus

## Big picture architecture
- Express API lives in src/server/app.ts (current) with TSOA-generated routes from src/controllers and src/generated/routes.ts; src/server/index.ts is a legacy minimal Sheets server.
- ETL flow: routes/controllers call service layers (src/services) which fetch external data (Meta/GA4/Shopify) and append to Sheets via sheetsService; queue/worker/scheduler run the same service workflows for scheduled jobs.
- Credentials are multi-tenant: stored encrypted in Postgres (src/lib/database.ts schema) and accessed via service configs + RLS; auth middleware sets user context from Clerk JWT.
- Sheets access uses service-account credentials from the DB and Redis-backed caching/locking in src/services/sheets.ts + src/lib/redis.ts.

## Key entry points and patterns
- HTTP server bootstrap and middleware stack: src/server/app.ts (security headers, rate limiting, API key gate, Swagger UI).
- Legacy routers in src/routes/* are still used for some endpoints; new endpoints should prefer TSOA controllers.
- Queue processing uses BullMQ in src/lib/queue.ts and src/lib/worker.ts; scheduled runs are orchestrated in src/lib/scheduler.ts (delegates to enhanced scheduler).
- Database access goes through executeQuery and must pass userId to enforce RLS (see src/lib/database.ts and middleware in src/middleware/auth.ts).

## Developer workflows (backend)
- Build: npm run build (runs tsoa spec-and-routes then tsc). Output targets dist/server/app.js.
- Dev: npm run dev (tsoa + tsc -w + nodemon). There is also npm run dev:legacy for the old server.
- Tests: npm test (jest).
- Docker: npm run docker:build | docker:up | docker:down | docker:logs | docker:dev.

## Developer workflows (dashboard)
- Frontend lives in dashboard/ and runs independently with Vite: npm run dev, build, lint, preview (see dashboard/package.json).

## Project-specific conventions
- Prefer service workflows for syncs (ga4Service.runWorkflow, metaService.runWorkflow, shopifyService.runWorkflow) so credential handling and token refresh remain consistent across manual and scheduled runs.
- GA4 service intentionally omits advertiserAdCost due to GA4 validation issues (see src/services/ga4.service.ts).
- Sheets ranges should be built with sheetsService.formatRange/a1 to avoid quoting bugs (see src/services/sheets.ts).
- Deprecated endpoints return 410 with Sunset/Deprecation headers; preserve this behavior when touching legacy routes (see src/server/app.ts).

## Integration points
- External APIs: Google Sheets + Drive, GA4 Analytics Data API, Meta Ads, Shopify.
- Auth: Clerk JWT in Authorization header (middleware in src/middleware/auth.ts).
- Data stores: Postgres with RLS (credentials, service_configs, sheet_mappings) + Redis for cache/locks + BullMQ queue.
