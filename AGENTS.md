# AGENTS.md

This file is the working guide for automated agents operating in this repository.

## Project Snapshot

- Product: B2B tender/bid document review platform.
- Frontend: React 18, Vite, TypeScript, Tailwind CSS, Radix UI, React Query.
- Backend: Express, TypeScript.
- Data: SQLite for local app data plus a Drizzle-managed relational mirror.
- Authentication: username/password login with opaque Bearer session tokens.
- Access control: project-scoped isolation for normal users; admins can access all projects.
- Realtime: Server-Sent Events (SSE) for review task updates.
- AI path: OpenAI-compatible API, configured through `.env`.
- Runtime protection: global task dispatch, AI in-flight limiting, and runtime health sampling are enabled on the backend.

## Key Directories

- `src/`: frontend pages, feature components, hooks, formatting helpers, tests.
- `src/context/`: auth context and session lifecycle.
- `src/routes/`: route guards such as `RequireAuth` and `RequireAdmin`.
- `server/`: API entrypoints, validators, service-layer business logic.
- `shared/`: shared API/domain/SSE types used by both frontend and backend.
- `drizzle/`: generated migrations and schema snapshots.
- `server-data/`: local SQLite database files.
- `storage/`: uploaded file storage.
- `dist/`, `dist-server/`, `.codex-temp/`: generated or local-only directories. Do not modify unless the task explicitly targets them.

## Start Here

Install dependencies:

```bash
npm install
```

Run backend:

```bash
npm run server:dev
```

Run frontend:

```bash
npm run dev
```

Useful checks:

```bash
npm run lint
npm run test
npm run build
npm run server:build
```

Database workflow:

```bash
npm run db:generate
npm run db:push
```

Default local ports:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:8787`

## Change Map

- Page routing: `src/App.tsx`
- Page entry files: `src/pages/`
- Feature UI and page composition: `src/components/features/`
- Frontend data fetching and subscriptions: `src/hooks/`, `src/lib/api.ts`, and `src/lib/fetch-sse.ts`
- Frontend auth/session utilities: `src/context/AuthProvider.tsx` and `src/lib/auth.ts`
- API routes: `server/app.ts`
- Core backend behavior: `server/services/*.ts`
- Backend auth and access control: `server/services/auth-*.ts`, `server/services/access-control-service.ts`, and `server/services/http-error.ts`
- Runtime health and load control: `server/services/runtime-health-sampler.ts`, `server/services/global-load-controller.ts`, `server/services/ai-inflight-limiter.ts`
- Shared contracts: `shared/types/*.ts`
- Database schema: `server/db/schema.ts`
- Drizzle config: `drizzle.config.ts`

## Repo-Specific Rules

- Keep backend responses, frontend consumers, and shared types aligned. If a payload shape changes, update `shared/types` first, then the server and client.
- Keep auth and access checks centralized. Prefer `auth-middleware` + `access-control-service` over ad-hoc permission checks inside route handlers.
- `/api` endpoints are authenticated by default. Public exceptions are `GET /api/health`, `GET /api/health/runtime`, and `POST /api/auth/login`.
- Project is the isolation boundary: non-admin users can only access their own `Project.ownerUserId` scope and its related documents/tasks/findings.
- If you touch project/task/document/finding reads or writes, review `server/services/access-control-service.ts` and ensure hidden resources return not-found style behavior.
- Admin safety rule: never allow disabling or demoting the last active admin account.
- Regulation library is global read; write endpoints are admin-only.
- If you touch SSE behavior, review these files together:
  - `shared/types/sse.ts`
  - `server/services/review-task-stream-service.ts`
  - `src/hooks/use-task-event-stream.ts`
  - `src/lib/fetch-sse.ts`
  - `src/lib/auth.ts`
- If you touch health or load-shedding behavior, review these files together:
  - `server/app.ts`
  - `server/services/runtime-health-sampler.ts`
  - `server/services/global-load-controller.ts`
  - `server/services/ai-inflight-limiter.ts`
- If you change review execution logic, inspect related services together instead of patching one file in isolation. Important files include:
  - `server/services/review-service.ts`
  - `server/services/ai-review-service.ts`
  - `server/services/tender-ai-review-service.ts`
  - `server/services/review-chapter-concurrency-service.ts`
  - `server/services/ai-key-pool-service.ts`
  - `server/services/ai-retry-service.ts`
- If you change task polling, task detail refresh, or SSE reconnect behavior, inspect these files together:
  - `src/components/features/task-detail/TaskDetailPageContainer.tsx`
  - `src/hooks/use-task-event-stream.ts`
  - `src/hooks/use-page-visibility.ts`
  - `src/hooks/queries/useReviewTasks.ts`
- `GET /api/health` is a compatibility endpoint. Do not break its response shape. Put runtime-only fields on `GET /api/health/runtime`.
- `server/store.ts` now serves reads from an in-memory snapshot cache and exposes `store.getVersion()`. If you add high-frequency read paths, prefer versioned read-model caching over rebuilding derived maps on every request.
- If you change persistence or relational reporting, update schema and migrations together. Do not delete local SQLite files unless explicitly asked.
- Never commit secrets from `.env`. Add new configuration keys to `.env.example`.
- Preserve existing file encodings when editing user-facing Chinese text. Some server-side error strings already show encoding artifacts and should be handled carefully.

## Validation Expectations

- UI-only changes: run `npm run lint`.
- Shared type, hook, or component changes: run `npm run test`.
- Backend service changes: run `npm run test`.
- Health/runtime, dispatcher, limiter, or store read-model changes: run `npm run test` and `npm run lint`.
- Build or config changes: run `npm run build` and `npm run server:build`.
- Schema changes: run `npm run db:generate` and document migration impact.

## Practical Notes

- Backend startup happens in `server/index.ts`, which initializes review workers before listening.
- Auth bootstrap happens during app creation. If no users exist, the backend requires `AUTH_BOOTSTRAP_ADMIN_PASSWORD` and creates the initial admin.
- Runtime load control starts during backend initialization and depends on `server/index.ts` calling review worker initialization before traffic is served.
- Current throughput tuning is layered:
  - Task-level dispatch in `server/services/review-service.ts`
  - Chapter-level adaptive concurrency in `server/services/review-chapter-concurrency-service.ts`
  - Global AI in-flight limits in `server/services/ai-inflight-limiter.ts`
  - Runtime degradation signals in `server/services/runtime-health-sampler.ts` and `server/services/global-load-controller.ts`
- Review flows are intentionally fail-fast when AI configuration is missing; do not add silent local-rule fallbacks unless the task explicitly asks for that behavior.
- Frontend task detail pages should avoid duplicate pressure: prefer SSE when connected, fall back to polling only when needed, and keep page-visibility behavior intact.
- `README.md` gives the high-level product overview; `server/README.md` covers backend operational details.
