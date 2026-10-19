# Fable production readiness — current status

## Current local runtime - 19 October 2026

The user chose Docker for PostgreSQL only and will start the Express API, Vite frontend and Expo client manually with npm. The single `docker-compose.yml` retains PostgreSQL 16, loopback-only port publishing and the existing `fable_postgres_data` named volume. The production Compose file, application Dockerfiles, Docker ignore files and Nginx configuration were removed. Earlier container/Neon deployment descriptions below are historical evidence and no longer describe the current setup.

Root `.env.example` now documents PostgreSQL settings. The ignored root `.env` was created from the backend's existing local database settings, and the missing `DIRECT_DATABASE_URL` was configured for that same local database. The existing `DATABASE_URL` was preserved. Client environment examples, AGENTS.md, architecture and handoff now describe the manual application workflow.

Verification passed: `docker compose config --quiet`, Prisma schema validation, source format checks and `git diff --check`. A read-only resolved-configuration review confirmed that PostgreSQL is the only service, the published port is on loopback, the existing volume name is unchanged, and both application database URLs match the container settings. Git ignores both private environment files. No database was started, migrated, reset or deleted during this change; database runtime and Firebase access remain separate manual checks.

## Maintenance cleanup - 19 October 2026

Status: implemented and verified locally. The working tree already contained substantial user work; this cleanup used that state as its baseline and did not reset it. Express/Prisma, Firebase identity, the database schema, migration history and deployment topology were retained. No migration, production deployment or live-provider write was performed.

### Changes

- Removed unused Expo starter artwork/hooks, one-line barrels, repository-local design skill packs, old browser results, generated audit exports, a debug log, an obsolete asset exporter, duplicate READMEs and an unused backend DTO file. Setup is consolidated in ARCHITECTURE.md. All requested audit/instruction/architecture/handoff records and the mobile license notice remain.
- Separated invitations, workspace membership, channel rosters, consistent message snapshots and transactional message mutations. Message mutations now use a discriminated input type instead of optional fields and non-null assertions for unrelated operations.
- Moved chat synchronization out of both dashboard components; extracted native message rows and reused one web room-creation form. Existing bounded windows, revision guards, checkpoints, private-room authorization and draft recovery remain in the implementation.
- Split web transport from endpoints and native session handling from feature endpoints. Removed the unused native login-token callback argument, unused API wrappers, 16 unused web icons, unreachable media placeholders, unused native styles/theme definitions, an unimported mobile stylesheet and dead speaking/card CSS.
- Documented source responsibilities and retained comments explaining security/ordering/lifecycle decisions. Added pinned, development-only Prettier commands and unused-declaration/parameter checks for backend/mobile. No test files, test-only dependencies or GitHub workflows were added.
- Removed seven unused/redundant direct mobile dependency declarations. Retained Router's transitive UI/glass/symbol dependencies and the patched URI-decoder compatibility adapter. Expo tooling aligned SDK 57 patches to Expo 57.0.30, Constants 57.0.22, Linking 57.0.13 and Router 57.0.28; React 19.2.3 and React Native 0.86.3 stay pinned.

### Verification

| Check | Result and scope |
| --- | --- |
| `npm run check` at root | Passed: format, Prisma schema validation/generation, backend build, web production build, mobile strict types and mobile lint. |
| `npx expo install --check` in mobile | Passed: dependencies are up to date for SDK 57. |
| `npx --yes expo-doctor` in mobile | Passed: 21/21 checks. |
| `npx expo export --platform android --platform ios --platform web --max-workers 2 --output-dir <temporary-directory>` | Passed: Android/iOS Hermes bundles, web bundle and three static routes. Output is outside the repository. |
| Read-only route/source review | Same 43 route declarations. 39 route-handler syntax trees match the pre-cleanup baseline after normalizing moved helper names. Four message handlers now call the typed mutation service with an operation field. No new checked-in harness was created. |
| `git diff --check` | Passed. |
| Final source/lockfile review | Every remaining TypeScript application module is reachable from an app entry point; application manifests match their lockfiles. No source test files were found. |

The initial baseline also passed its existing build/type/lint checks. Source copies and removed/generated directories were retained locally under `C:\Users\Suraj\AppData\Local\Temp\fable-maintenance-BPFJMW` to make this cleanup reversible; this is temporary local recovery material, not a durable project backup.

### Remaining verification

No real Firebase email delivery, authorized cross-client database journey, container rollout, signed installation or physical-device accessibility/performance walkthrough was performed. Recheck verified login, workspace switching/revocation, message send/edit conflicts, exact search navigation, history/pin paging, profile/theme persistence and native background/resume against staging before release. Build/export success does not certify those flows.

The mobile installer still reports 18 high-severity dependency findings. Their resolution remains existing release/security work; this cleanup did not use a forced audit fix or claim those findings are resolved. Keep the historical audit evidence below separate from the current static/build evidence.

---

Updated: 14 October 2026.

**Core text-collaboration implementation is substantially complete. Full production release is not signed off.** The actual backend remains Express/TypeScript/Prisma, as the user requested. No live Firebase/Neon account, production migration, external hosting deployment or signed native distribution was performed.

Use [ARCHITECTURE.md](ARCHITECTURE.md) for the current implementation and contracts, and [GEMINI_HANDOFF.md](GEMINI_HANDOFF.md) for exact release tasks and future feature plans.

## Current implementation and parity

| Area | Web and mobile behavior |
| --- | --- |
| Authentication | Firebase email/password, signup mail verification/signout, verified-only access, resend/reset links, session restore and local logout. |
| Account | Real profiles/status, account-backed appearance and confirmed all-device revocation. |
| Workspaces | Paged discovery/search/switch, create/rename/join, owner/admin/member management and recovery after revoked memberships. |
| Ownership/removal | Owner transfer and protected self-leave; administrative removal succeeds without private creator cooperation and preserves privacy/content. |
| Invitations/activity | Hashed email-bound one-use tokens, manual sharing, paged statuses/revocation and actual administrator activity. |
| Rooms | Real public/private rooms, paged roster/candidates, add/remove/leave, metadata/creator transfer and exact-name deletion. |
| Messaging | Real persisted text/code, reactions, independent pins, versioned edits/deletes, retained failed drafts and idempotent uncertain create retries. |
| History/search | Complete cursor-accessible server history, Earlier/Newer/Latest, full-text authorized search and exact centered result opening. |
| Unread/sync | Durable bounded change feed, monotonic read markers, archive isolation and authoritative counts after read acknowledgments. |
| UX/performance | Applied light/dark tokens, focus-managed forms/dialogs, native virtualized pages, reduced motion, background polling suspension, route splitting and request cancellation. |

These rows describe implemented source parity. They are not an exhaustive runtime/device certification. The manual journey/device matrix is in the handoff.

Unsupported calling/media controls, pretend device/volume settings and unused call screens were removed. Marketing feature copy is aligned to the implemented text-collaboration scope. DMs, threads, uploads/voice notes, push, automatic invitation mail and live voice/video are unfinished future features with detailed implementation plans.

## Security and correctness work in this continuation

- Added transactional workspace gates around membership-sensitive writes and refreshed actor roles inside transactions.
- Added the eighth additive migration for message idempotency and PostgreSQL full-text search/invitation indexes; no database deployment was performed.
- Added scoped query-bound search cursors, repeatable history snapshots and exact search-result windows.
- Independent review found and resolved a private-creator removal blocker: existing private participants may inherit ownership; empty private rooms retain inaccessible content without enrolling an administrator.
- Independent review found and resolved mobile's assumed zero unread count: successful markers are followed by a guarded server metadata refresh.
- Fixed selected-workspace headers for invitation listings on both clients.
- Added safe request IDs/logs, no-store API responses, strict HTTPS origins and Prisma TLS certificate checks.
- Production runtime defaults bound the connection pool and pool/query waits; unbounded zero values are rejected.
- Removed Prisma automatic production query/error logging that could expose invocation data.
- Added a direct-connection migration command, private non-root containers and deliberate two-hop HTTPS-proxy handling.
- Corrected forwarded-client-IP handling after review; the outer edge must overwrite headers and alternate public paths remain prohibited.

## User-requested cleanup

GitHub workflows, backend/web/mobile automated test files, Playwright configuration, fixture generators, audit test launchers, Auth Emulator test configuration and test-only dependencies/commands were removed. No replacement CI or test suite was added.

Local build/type/lint/schema checks remain. AGENTS.md now makes the hobby-project overrides explicit so future agents do not recreate the removed files or treat its reusable FastAPI architecture as a Fable migration requirement.

The package-level audit reports retain dated historical evidence from earlier work, with notices that their old test commands/inventories are no longer the current workflow.

## Verification evidence for current changes

- Root `npm run check` passed: Prisma client generation, API build, web production build, mobile TypeScript and mobile lint.
- Prisma schema validation passed.
- Expo SDK compatibility check reported dependencies up to date.
- Android and iOS Hermes exports passed. These are JavaScript exports, not native installations.
- Final web code splitting produced separate login/dashboard chunks and removed the previous greater-than-500-KiB main-chunk warning. This is bundle evidence, not a measured page-load benchmark.
- Independent backend/deployment source review completed, with the concrete issues above resolved.
- Backend and web npm dependency audits reported zero known findings. Mobile still reported 18 high advisory entries, no critical entries.
- No automated tests were run in this continuation, respecting the user's preference. No live production/private user records were used.

## Remaining release gates

1. Fill real Firebase/Neon/environment values and configure exact domains, provider policy, secure credentials and production URLs.
2. Verify received signup-verification and password-reset emails plus revoked/disabled identity behavior in the actual configured environment.
3. Rehearse a populated upgrade/restore, schedule migration 8's GIN lock or concurrent prebuild, then deploy through the direct role.
4. Drain old API workers before enabling new membership mutations; mixed old/new workers do not share the new locking guarantee.
5. Build/run the final Docker images behind the documented HTTPS topology. The local Docker engine was unavailable, so final image/runtime/health/header checks remain unverified.
6. Create signed native builds and manually verify secure persistence, keyboard/safe areas, native sharing/back and accessibility.
7. Profile release binaries on representative iOS/Android hardware, including 120 Hz devices: startup, frame times, RAM plateau, CPU/battery and thermal behavior.
8. Resolve or explicitly review the mobile toolchain advisories, configure monitoring/alerts and verify operational backup/recovery procedures.
9. Exercise the handoff's real-service cross-platform/manual acceptance matrix, including private access, removal, conflict, idempotency, paging and failure cases.

The mobile high findings propagate from current upstream `braces` and `node-forge` through Expo/Metro. Suggested major downgrades conflict with Expo 57 and were not applied. The exact advisory links and safe update instructions are in GEMINI_HANDOFF.md. A clean backend/web audit does not certify the mobile security gate.

## Release decision

The code now supports a coherent hobby text-collaboration release once the required environment/device/security checks are completed. The entire future collaboration product is not complete. Do not describe unimplemented media, DMs, threads or push as working, and do not describe the application as fully production ready before the outstanding evidence exists.
