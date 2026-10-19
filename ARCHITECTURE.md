# Fable architecture

Updated: 19 October 2026. This document describes the implemented application, its invariants and the deployment boundaries. Read `GEMINI_HANDOFF.md` for the remaining release work and detailed feature implementation plans. `AGENTS.md` contains the engineering rules and the user's no-CI/no-test-files preference.

## 1. Product and release boundary

Fable is a workspace collaboration application with public/private text rooms, searchable message history, reactions, pins, profiles and workspace administration. The web and Expo clients share Firebase identity and a PostgreSQL-backed API. The visual direction is an editorial/brutalist interface with paper backgrounds, strong borders, yellow accents and consistent typography.

The current usable scope is text collaboration. Direct messages, threads, attachments, voice notes, live audio/video, push notifications and automatic invitation email are separate, unfinished features. The released interface must not advertise an unsupported button as operational. Audio/video channel types and legacy media fields in the schema do not establish functioning media infrastructure.

The current setup runs PostgreSQL in Docker and starts the API, web and Expo clients manually with npm. Production readiness is not signed off: actual Firebase email delivery, populated migration verification, dependency review, future public hosting and native release/device checks remain. Local builds do not establish those external outcomes.

## 2. Implemented stack

| Layer | Current implementation | Target/constraint |
| --- | --- | --- |
| Web | React 19, TypeScript, React Router, Vite 6, Tailwind 4 | Preserve strict types and real API behavior. |
| Mobile | Expo SDK 57, React Native 0.86, React 19.2.3, Expo Router | Keep SDK-compatible native dependencies; build both Android and iOS. |
| API | Express 4, TypeScript, Zod, Firebase Admin, Prisma 6 | Keep the existing backend and its verified contracts. |
| Data | PostgreSQL 16 in Docker | Named persistent volume, loopback host access and reviewed migrations. Neon remains a future option. |
| Auth | Firebase Email/Password | Verification is mandatory before protected application access. |
| Running locally | Docker database; manually started Express, Vite and Expo processes | One Compose file. No API/web containers, GitHub workflows or checked-in tests. |

The exact installed versions come from the committed package lockfiles. The user explicitly chose to keep Fable's Express/Prisma backend. The FastAPI architecture in the reusable `AGENTS.md` template is not a migration requirement for this project. Document and extend the actual TypeScript/Express service; do not add a replacement Python backend.

## 3. System boundaries

```mermaid
flowchart LR
  Web[React web / Vite on host] -->|Email/password and mail actions| Auth[Firebase Authentication]
  Native[Expo iOS / Android] -->|Email/password and mail actions| Auth
  Web -->|Vite /api proxy| API[Express API on host]
  Native -->|Reachable host API URL| API
  API -->|Admin token and revocation verification| Auth
  API -->|Loopback PostgreSQL connection| DB[(PostgreSQL in Docker)]
  Operator[Manual Prisma migrations] -->|Explicit local migration connection| DB
```

Firebase owns credentials, password policy, ID/refresh tokens, verification emails and password-reset emails. PostgreSQL owns application profiles, workspace membership, room membership and all business records. Clients never receive database connection strings or Admin credentials. No local-password or second application-JWT system exists.

For the hobby deployment, use one API instance and the process-local abuse limiter. Multiple API instances require a shared limiter/edge abuse policy and, if realtime is added, shared event delivery. Do not introduce Redis, Kafka or Kubernetes without a demonstrated requirement.

## 4. Repository ownership and important files

| Path | Responsibility |
| --- | --- |
| `backend/src/app.ts` | HTTP middleware, CORS, request limits, router composition and safe errors. |
| `backend/src/index.ts` | Database connection, HTTP startup, timeouts and graceful shutdown. |
| `backend/src/lib/auth.ts` | Verified Firebase identity, application account and active membership resolution. |
| `backend/src/lib/access.ts` | Tenant/room scopes, management permissions and transactional lock helpers. |
| `backend/src/lib/messages.ts` | Safe message DTOs and SQL-aggregated reaction summaries. |
| `backend/src/lib/messageHistory.ts` | Consistent history/pin snapshots and durable replay checkpoints. |
| `backend/src/lib/messageMutations.ts` | Typed edit/delete/pin/reaction transactions and version checks. |
| `backend/src/lib/workspaceMembership.ts` | Departure/revocation safeguards and private-room ownership reconciliation. |
| `backend/src/routes/workspaceInvitations.ts`, `workspaceMembers.ts`, `channelMembers.ts` | Focused invitation and membership HTTP boundaries. |
| `backend/src/lib/search.ts` | Scoped full-text message search and query-bound cursors. |
| `backend/src/lib/directory.ts` | Bounded directory paging/query validation. |
| `backend/src/lib/telemetry.ts` | Request IDs, response cache protection and redacted structured logs. |
| `backend/src/routes/` | Actual HTTP contracts described below. |
| `backend/prisma/schema.prisma` | Application database model and indexes managed by Prisma. |
| `backend/prisma/migrations/` | Eight historical/additive migrations; do not rewrite already deployed history. |
| `frontend/src/services/` | Firebase identity, HTTP transport in `request.ts`, and typed endpoints in `api.ts`. |
| `frontend/src/components/chat/useChannelMessages.ts` | Bounded message/pin state, foreground polling and confirmed mutations. |
| `frontend/src/components/CreateRoomDialog.tsx` | One server-backed room form shared by the modal and empty state. |
| `frontend/src/components/` | Web dashboard, room context, profiles, administration and search. |
| `mobile/src/services/` | Native/web Firebase adapters, secure persistence, `session.ts` for auth/session scope, `request.ts` for HTTP, and `api.ts` for endpoints. |
| `mobile/src/components/chat/useChannelMessages.ts` | Native message windows, durable replay, pagination and confirmed mutations. |
| `mobile/src/components/chat/MessageRow.tsx` | Memoized row rendering and its own native styles. |
| `mobile/src/components/` | Native dashboard, virtualized chat/directories, management and search modals. |
| `mobile/src/constants/theme.ts` | Mobile design tokens; persisted appearance is applied by the client. |
| `scripts/check.mjs` | Local build/type/lint checks; no test framework or CI runner. |
| `scripts/deploy-database.mjs` | Explicit direct-connection migration deployment. |
| `docker-compose.yml` | PostgreSQL only, bound to loopback, with the existing `fable_postgres_data` volume. |
| `.env.example`, package `.env.example` files | Root variables configure Docker PostgreSQL; package variables configure manually run applications. |
| `mobile/app.config.ts`, `mobile/eas.json` | Configurable owned native identifiers and manual release profiles. |

Dashboards compose workspace navigation, settings and dialogs. Chat hooks own the related history/pin windows and concurrency guards; pure message-state helpers reconcile records. Keep those guards together when changing synchronization. Do not replace bounded pages with a global unbounded store. Each source module documents its responsibility; comments explain security, ordering and lifecycle constraints rather than narrating obvious syntax.

## 5. Identity and session lifecycle

Registration uses the Firebase client SDK, updates the real display name, sends a verification email and signs out. An unverified temporary SDK identity never provisions PostgreSQL data. Resending verification signs in temporarily with the entered password, sends the mail and signs out again. Password recovery requests the Firebase reset email and uses its browser action handler.

Login reloads the Firebase user and refuses unverified emails. The client obtains a Firebase ID token and calls `POST /api/auth/session`. The server verifies the configured project, signature, expiry, revocation/disabled status, `email_verified` and password sign-in provider. UID is the application identity boundary. Email matching alone never links legacy accounts.

Initial session provisioning atomically creates an `Account`, `User`, owner `WorkspaceMember`, personal workspace and empty `general` text room. These are records for an actual verified user, not sample data. A unique Firebase UID makes concurrent session creation idempotent. A pre-existing unmatched legacy email yields a deliberate conflict instead of transferring that account silently.

Ordinary logout uses Firebase client sign-out and clears scoped selection/cache state. `POST /api/auth/logout` is an all-device token-revocation endpoint, not a routine per-device logout. Mobile refresh credentials use the existing serialized/chunked SecureStore persistence adapter; its physical Keychain/Keystore lifecycle still requires manual native verification.

Every protected request resolves the current database identity and membership. `X-Workspace-Id` selects an active workspace; otherwise the oldest membership is used. Discovery, workspace create/join and personal account routes deliberately remain recoverable without a workspace or with a stale saved selection. Tenant routes still require actual membership.

## 6. Database and relationships

```mermaid
erDiagram
  USER ||--o| ACCOUNT : identity
  USER ||--o{ WORKSPACE_MEMBER : belongs
  WORKSPACE ||--o{ WORKSPACE_MEMBER : includes
  WORKSPACE ||--o{ CHANNEL : contains
  USER ||--o{ CHANNEL_MEMBER : joins
  CHANNEL ||--o{ CHANNEL_MEMBER : includes
  CHANNEL ||--o{ MESSAGE : contains
  USER ||--o{ MESSAGE : authors
  MESSAGE ||--o{ REACTION : receives
  MESSAGE ||--o{ MESSAGE_CHANGE : synchronizes
  WORKSPACE ||--o{ INVITATION : invites
  WORKSPACE ||--o{ AUDIT_EVENT : records
  USER ||--o| WORKSPACE_SETTING : prefers
```

| Model | Purpose and important constraints |
| --- | --- |
| `Account` | Unique email, Firebase UID and user relation. UID can be null only for legacy migration records. No password fields. |
| `User` | Real profile, unique handle, monogram, status text and expiring presence heartbeat. Public DTO excludes account email. |
| `Workspace` | Tenant name and lifecycle timestamps. Ownership is represented by membership role. |
| `WorkspaceMember` | Composite workspace/user primary key; role constrained to owner/admin/member. Directory indexes include creation time and ID ties. |
| `Channel` | Scoped unique name, topic, text/audio/video type, visibility and creator reference. Workspace cascade is intentional only under an authorized lifecycle operation. |
| `ChannelMember` | Composite channel/user key, read timestamp and message-ID tie-breaker. Private access depends on actual membership. |
| `Message` | Author, room, content/code, creation/edit/delete timestamps, version, pin flag and optional client mutation ID/hash. |
| `Reaction` | Unique message/user/icon; supported icons are constrained. Counts are grouped in SQL. |
| `MessageChange` | Durable bigint change sequence with room/message indexes; serialized writes make room cursors safe. |
| `Invitation` | Intended verified email, hashed random secret, seven-day expiry and one-use acceptance. The raw secret is returned only at creation. |
| `AuditEvent` | Workspace, actor, action, target and limited metadata; administrators can inspect bounded pages. |
| `WorkspaceSetting` | Despite the historical name, settings are account scoped through a unique user ID. Media fields remain dormant legacy preferences. |
| `LegacyArchive` | Inaccessible archived historical metadata; no public API or automatic account import. |

Database timestamps are `timestamptz(3)` and API dates are UTC ISO strings. Message creation time is immutable. Clients localize display time without changing ordering. Bigint synchronization cursors are serialized as strings. Selected message/pin windows do not limit the accessible history stored on the server.

The eighth migration adds message-create idempotency columns/constraints, an invitation paging index and a partial GIN full-text index on live message content plus code. It preserves existing content. On a large installation, plan the GIN build's write lock or prebuild the index concurrently as documented in the migration. Never assume a schema validation command has deployed that migration.

Earlier migrations baseline the original schema, isolate workspaces, expire presence, convert timestamps, add collaboration controls, handle read ties and add directory indexes. Historic shared rooms are quarantined, not assigned to arbitrary new accounts. Preserve this boundary during future schema changes.

## 7. Permissions and administration

| Operation | Policy |
| --- | --- |
| Discover/create/join workspaces | Provisioned verified identity; invitation email must match. |
| Read public room | Current workspace membership. |
| Read private room | Current workspace membership plus actual private-room membership. Admin status alone is insufficient. |
| Create text room | Workspace member; creator gets room membership. |
| Edit/delete room or transfer creator | Creator or workspace owner/admin with actual room access. |
| Invite/list/revoke invitations, rename workspace | Current owner/admin, rechecked transactionally. |
| Promote/demote workspace member | Owner only; owner role changes through ownership transfer. |
| Remove workspace member | Owner; admin may remove an ordinary member, not another admin/owner. |
| Leave workspace | Non-owner with another workspace, after transferring owned rooms. |
| Transfer workspace ownership | Owner to another actual workspace member; former owner becomes admin. |
| Edit message | Author of a live, accessible message. |
| Delete message | Author or workspace owner/admin with actual room access. |
| Pin/react | Member who can access the live message's room. |
| Audit history | Workspace owner/admin. |

Ownership safeguards distinguish voluntary departure from administrative revocation. Voluntary self-leave requires transferring owned rooms and workspace ownership first. Administrative removal cannot be blocked by a private-room creator: private ownership moves to the earliest remaining actual room participant who still belongs to the workspace, or becomes null if none remains. Public creator references are detached. Messages/privacy are preserved; administrators are never enrolled in the private room. A counts-only reconciliation event is audited. A private room's explicit new creator must already belong to that room. Self-leave cannot strand a user without another membership; an administrator can revoke a person's last membership for security, and that account can then create/join a workspace through recovery paths.

Channel deletion requires the exact room name and removes its message/history relationships according to the schema. It is an actual destructive operation; both clients must show its consequence before submission. Workspace deletion/account deletion are not implemented lifecycle shortcuts.

## 8. Transaction and synchronization invariants

Membership mutations take an exclusive workspace advisory transaction lock. Channel/message mutations take a shared workspace gate followed by the existing channel lock. Actor membership/role is rechecked inside the transaction. Removals across workspaces also serialize per affected user, preventing simultaneous self-leaves from bypassing the last-workspace safeguard. Keep the documented lock order when adding writes.

Deployment must drain old API workers before enabling these new membership operations: old workers do not participate in the new workspace gate. A mixed old/new rollout does not inherit the new race guarantee.

Message mutations serialize by room, increment an integer version and create a durable `MessageChange` in the same transaction. A sequence allocation by itself is not commit ordering; retain the room transaction lock. History and pins capture a checkpoint with their consistent snapshot so edits to old rows can be caught up afterward.

Editing/deleting/pinning requires an expected version; stale writes return 409 and clients retain drafts. No-op edits/pins do not create unnecessary versions/events. Deletion purges content, code/media metadata, reactions and pins while retaining a tombstone ID/time for valid history/read cursors.

Message creates may include `clientMutationId`, unique per room/sender. The stored payload fingerprint makes a retry return the existing record; a conflicting payload using the same key returns 409. Clients keep the key for an uncertain retry and create a new key for a different operation. This is not an offline queue or a license to retry arbitrary mutations.

History uses stable `(createdAt, id)` cursors. `before`, `after` and `around` are mutually exclusive. The `around` window opens an exact search result without marking unrelated unseen live messages read. Pins have independent history pages. Read markers advance monotonically and include an ID tie-breaker; archive browsing does not acknowledge unseen future messages.

## 9. HTTP contracts

Base path: `/api`. Headers: `Authorization: Bearer <Firebase ID token>`, and `X-Workspace-Id` for scoped resources. JSON request bodies are capped at 64 KiB. Failure responses contain `error`; central error responses also include a safe request ID. The `X-Request-Id` response header is available for support without logging user content.

| Endpoint | Contract |
| --- | --- |
| `POST /auth/session`, `GET /auth/me`, `PATCH /auth/profile` | Real session/profile DTO `{ user }`; profile accepts name/status text only. |
| `POST /auth/logout` | Revoke all-device Firebase refresh tokens; 204. |
| `POST /auth/login`, `/auth/register` | Retired local auth, 410; clients use Firebase directly. |
| `GET /workspace` | User's paged workspaces, roles, total and current selection. |
| `POST /workspace { name }` | New workspace with owner membership and empty general room. |
| `GET/PATCH /workspace/:id` | Membership lookup / owner-admin rename. |
| `PATCH /workspace/:id/members/:userId { role }` | Owner changes admin/member role. |
| `DELETE /workspace/:id/members/:userId` | Authorized removal with ownership safeguards. |
| `POST /workspace/:id/transfer-ownership { userId }` | Transfer to existing member. |
| `POST /workspace/:id/leave {}` | Protected self-leave; 204. |
| `GET/POST /workspace/invitations` | Bounded status listing / email-bound invitation creation. |
| `DELETE /workspace/invitations/:id` | Revoke an unaccepted invite, never expose its secret again. |
| `POST /workspace/join { token }` | Atomic acceptance matching verified email. |
| `GET /workspace/audit?before=&limit=` | Administrator's reverse chronological bounded audit page. |
| `GET/POST /channels` | Paged/searchable accessible rooms / real room creation. |
| `GET/PATCH/DELETE /channels/:id` | Actual room / metadata update / exact-name-confirmed deletion. |
| `POST /channels/:id/transfer-ownership { userId }` | Move creator to a valid member. |
| `GET/POST/DELETE /channels/:id/members...` | Scoped roster and private-room membership administration. |
| `GET /channels/:id/member-candidates` | Actual workspace members excluding all existing room members. |
| `POST /channels/:id/read { messageId }` | Mark only the loaded message watermark. |
| `GET /channels/:id/pins?before=&after=&limit=` | Independent bounded pin window. |
| `GET /messages/:channelId?before=&after=&around=&limit=` | Consistent bounded chronological window. |
| `GET /messages/:channelId/changes?after=&limit=` | Durable changes for any retained window. |
| `POST /messages { channelId, content, codeSnippet?, clientMutationId? }` | Real text/code create; same-key retries reconciled. Unsupported media is rejected. |
| `PATCH/DELETE /messages/:id`, `PUT /messages/:id/pin` | Authorized versioned mutation. |
| `POST /messages/:id/reactions { icon }` | One of six supported reaction icons; real SQL counts/viewer flag. |
| `GET /messages/search?q=&channelId=&after=&limit=` | Authorized live content/code lexical search; `{ data: [{ message, channel }], hasMore, nextCursor }`. |
| `GET /team/members`, `POST /team/profiles { userIds }` | Paged directory / at most 100 scoped profile references. |
| `GET/PUT /settings` | Account-scoped persisted preferences with strict field validation. |
| `GET /health/live`, `/health/ready` | Process liveness / DB-aware readiness, 503 when unavailable. |

Directory pages use `limit` (default 50/max 100), `after` and `q`; return `data`, `total`, `hasMore`, `nextCursor`. History pages additionally return `changeCursor`, `hasOlder`, `hasNewer`, `olderCursor`, `newerCursor`. Search accepts 2–120 characters, returns newest matches first and uses a filter/workspace-bound opaque cursor. It searches all server history, not just cached messages. Current matching is PostgreSQL `simple` lexemes with AND semantics, not arbitrary substring/fuzzy ranking. A 2.5-second transaction-local search statement timeout bounds expensive queries.

## 10. Client state, memory and UI

Keep identity state separate from active workspace/room and server content. Scope every cache/async response to the current session and selection. Discard late responses after a switch, logout, modal close or superseding request. Preserve drafts when requests fail; do not inject fictional successful messages.

The existing clients page directories, history and pins. Mobile retains bounded live/archive windows and uses native virtualized lists. Web retains bounded message pages and cursor metadata. Batch profile lookups refresh retained historical authors without loading the whole workspace. Reuse stable row objects so a reaction does not rerender unrelated message rows.

Polling is foreground aware and bounded; this is not a deployed WebSocket system. Stop inactive polling and cancel obsolete requests. Native appearance follows persisted theme tokens, while web uses corresponding theme variables. Removed device-volume/media controls must not return until a real media service consumes them.

Accessibility includes labeled forms/actions, focus-managed web dialogs, native back dismissal, keyboard handling, adequate touch targets, readable contrast and reduced motion. Physical screen-reader/font-scaling review remains a release task. A 120 Hz setting permits device capability but does not prove 120 fps; require release-build frame-time/memory/battery measurements.

## 11. Local runtime and configuration

Docker runs only PostgreSQL through the root `docker-compose.yml`. The API, Vite frontend and Expo client run as ordinary processes on the developer's computer. No API/web Dockerfiles, production Compose file or Nginx config are maintained for the current workflow.

Root `.env` contains `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` and `POSTGRES_PORT`. The database is published only on `127.0.0.1`; its data stays in the existing `fable_postgres_data` named volume across ordinary stops. Changing an environment variable does not change credentials already stored in an initialized database.

`backend/.env` supplies `DATABASE_URL`, `DIRECT_DATABASE_URL`, Firebase Admin configuration and `FRONTEND_URL`. Both database URLs target the same local PostgreSQL instance; there is no separate transaction pooler. Keep `NODE_ENV=development` for this local setup. Firebase identity and verified-email authorization still apply.

`npm --prefix backend run prisma:deploy` is an explicit migration operation. The wrapper requires `DIRECT_DATABASE_URL` and accepts the local database; it never falls back to runtime credentials or runs automatically at API startup. Review an existing database's schema and migration history before applying the baseline.

The frontend reads public Firebase values from `frontend/.env`. Its `/api` requests are proxied by Vite to `http://localhost:5000`. Mobile reads `mobile/.env` and reaches the host API rather than the database. A physical device needs the computer's reachable LAN API address; Android emulators can use `10.0.2.2`. Leaving the development API URL blank enables the existing Expo host detection.

API logs retain safe route/status/duration/request-ID metadata without queries, tokens or message bodies. Application process supervision and public hosting are future choices. If public deployment is requested, configure HTTPS, exact origins, trusted proxies, security headers, backups and monitoring for that actual topology. Existing production TLS/authentication guards remain; Vite development serving is not a production deployment.

## 12. Local verification and remaining evidence

The user's current policy excludes GitHub workflows and test files. Run `npm run check` from the root for format checking, schema validation/generation, API/web builds, mobile strict types and mobile lint. Run Prisma schema validation and Android/iOS exports separately when the schema or native dependencies change. These checks do not apply migrations, contact production, send email, sign binaries or prove native behavior.

Keep historical audit reports as dated evidence, not descriptions of the current workflow or a guarantee for later changes. Record actual current results and pending manual checks in `GEMINI_HANDOFF.md`. Do not recreate removed tests or CI as part of a future feature implementation unless the user explicitly changes this preference.

## 13. Setup and everyday maintenance

Use Node 24 and npm with the committed lockfiles. Install each package:

```sh
npm ci
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix mobile ci
```

Copy root `.env.example` to root `.env` for Docker PostgreSQL. Copy each package's `.env.example` to its local `.env` file. Set a database password and match the username, password, database name and port in `backend/.env`'s two database URLs. URL-encode special password characters inside connection URLs. Existing local settings are preserved; the current root `.env` was matched to the backend's already configured local database. Public Firebase values belong in the client files; Admin credentials remain server-side.

Configure Firebase Email/Password, matching client/server project IDs, authorized domains and real verification/reset email handling. Existing registration accepts passwords of at least 12 characters; Firebase's configured policy is authoritative. Email verification remains mandatory before application access.

Start only the database:

```sh
docker compose up -d postgres
```

For a new or properly baselined database, apply the reviewed migrations explicitly and generate the client:

```sh
npm --prefix backend run prisma:deploy
npm --prefix backend run prisma:generate
```

Existing databases need a schema/migration-history review before deployment; do not reset them to get started. `docker compose stop postgres` stops the database while preserving its named volume.

Run these in separate terminals:

```sh
npm run dev:api
npm run dev:web
npm run dev:mobile
```

Web proxies `/api` to port 5000. Mobile requires a reachable API URL ending in `/api`; production requires HTTPS. See section 11 for the local runtime boundaries and the handoff for future hosting/EAS release work.

Use `npm run format` after editing source and `npm run check` before accepting a change. Prettier is a pinned development-only formatter; it adds no runtime code. API and both clients reject unused local declarations and parameters. No test suite or CI is installed.

After native dependency changes, run these from `mobile/`:

```sh
npx expo install --check
npx expo-doctor
npx expo export --platform android --platform ios --platform web --max-workers 2
```

Expo compatibility follows the [SDK reference](https://docs.expo.dev/versions/v57.0.0/) and [Router installation requirements](https://docs.expo.dev/router/installation/). SDK 57 and the pinned React 19.2.3 / React Native 0.86.3 combination were preserved. Expo, Constants, Linking and Router were aligned to the SDK-recommended patch versions with `expo install --fix`. Router's own Expo UI/glass/symbol dependencies remain transitive; unused application-level declarations and unused starter modules were removed.

The tiny `mobile/vendor/decode-uri-component` adapter remains necessary: Expo's CommonJS query parser expects a function while the patched upstream decoder exports an ESM default. Its code delegates to the patched dependency. Keep it until that compatibility boundary is resolved; do not remove security overrides merely because the app has no direct import.

Only runtime source/assets, dependency locks, development/build/deployment configuration, required license notices and the requested architecture/handoff/audit/instruction documents are retained as project files. Duplicate READMEs were consolidated here. Starter imagery, unused color-scheme hooks/barrels, repository-local design skill packs, obsolete asset-export tooling, old browser results and generated audit exports were removed from the project. Audit reports and their existing dependency snapshot remain historical evidence.
