# Fable implementation handoff for Gemini

Updated: 19 October 2026. Read this file with `ARCHITECTURE.md` and the Fable overrides at the top of `AGENTS.md`.

## 1. Instructions to the next coding agent

You are continuing an existing hobby collaboration app, not generating a new starter. Act as a senior full stack architect, React/React Native developer and UI/UX designer. Inspect the working tree before editing and preserve existing user work.

The user explicitly requested:

- Keep this project's working **Express + TypeScript + Prisma** backend. The FastAPI specification in the reusable `AGENTS.md` template does not describe Fable's current backend and is not a requested migration.
- Keep React 19 web, Expo SDK 57 mobile, PostgreSQL and Firebase Email/Password authentication.
- Run PostgreSQL in Docker only. Start the API, Vite frontend and Expo client manually with npm. Keep one `docker-compose.yml`; do not restore application Dockerfiles, production Compose or Nginx without a new request. Neon is a possible future target.
- Require clicking the Firebase email verification link before application login/access; support password reset by received email link.
- Show only real authorized backend/database data. Never revive demo users, fake messages, synthetic calls, fabricated counts or offline-success fallbacks.
- Maintain equivalent content, permissions and capabilities on web/mobile, with native layouts and bounded mobile memory.
- Do not create GitHub workflows, test files, fixture generators or automated test harnesses. Use builds, strict type checks, lint, schema validation and documented manual verification.
- Keep the repository focused on the runnable apps: preserve AGENTS.md, ARCHITECTURE.md, GEMINI_HANDOFF.md and audit records; avoid test files, log artifacts, starter assets and duplicate documentation. Setup commands now live in ARCHITECTURE.md.
- Produce honest release evidence. Do not claim real mail delivery, deployed database safety or measured native 120 Hz performance from static checks.

Make useful progress without repeated confirmations. Ask only for a truly missing decision or externally required access. The user manages local PostgreSQL and Firebase values in environment files; do not ask them to paste credentials into chat. Never run a destructive database command merely to fix a development error.

Prioritize the current local workflow and one requested feature slice at a time. Section 4 records local setup and later release work; it is not an instruction to add hosting infrastructure automatically. Do not implement every speculative feature or add unnecessary paid infrastructure without product scope. Do not silently turn this handoff into permission to publish or message users.

## 2. What is implemented now

The following has source implementation on both clients and the actual API. Current compilation is a separate evidence category from live environment verification.

| Feature | Implemented behavior |
| --- | --- |
| Authentication | Real Firebase signup, mail verification, resend, password reset, verified login, session restore and local logout. |
| Session provisioning | Atomic real profile/personal workspace/general room creation; UID binding and idempotent concurrent provisioning. |
| Profile | Persisted name/status, appropriate public DTOs and retained-author refresh. |
| Workspaces | Paginated discovery/search/switch, create, rename, join and recovery after all memberships are revoked. |
| Workspace roles | Owner-only promote/demote, protected removal, protected self-leave and owner transfer. |
| Invitations | Email-bound, expiring, single-use hashed tokens; manual copy/native sharing; paginated status list and revocation. |
| Rooms | Paginated directories, real creation, private roster/candidates, add/remove/self-leave, name/topic editing, creator transfer and typed-name deletion. |
| Text/code messaging | Actual persisted records, stable chronological pagination, retained drafts and scoped client mutation IDs for uncertain retries. |
| Message history | Earlier/Newer/Latest and exact centered search-result navigation with bounded retained pages. |
| Reactions/pins | Six real reaction summaries, independent pin pages and versioned mutations. |
| Editing/deletion | Author edits, authorized deletion, expected-version conflicts, content-purged tombstones and preserved unsaved drafts. |
| Search | Server PostgreSQL full-text search across all authorized live text/code history, workspace/room scope and bounded pages. |
| Read/unread | Monotonic timestamp/ID watermarks; archive/search browsing does not clear unseen future content. |
| Synchronization | Bounded foreground polling and durable message changes for off-window edits/deletes/reactions. |
| Administration activity | Real paginated owner/admin audit history on web/mobile. |
| Appearance | Real account-backed light/dark themes applied to web/native tokens and refreshed while active. |
| Account-wide logout | Explicit confirmation before server-side revocation of all-device refresh tokens. |
| Local runtime/release boundaries | Docker PostgreSQL only, manual API/web/Expo commands, production-origin/TLS guards, explicit migrations and EAS profiles. |

Disconnected calling buttons, pretend microphone/device/volume controls and unused call screens were removed. Dormant media schema fields do not mean attachments or voice/video work. Do not reintroduce those controls until the relevant implementation is complete.

### Current verification boundary

The repository retains no automated test suites or GitHub workflows. Historical audit files describe previously executed tests before their removal; they are not executable current instructions and do not verify later changes.

API/web builds, schema generation/validation, mobile strict types/lint and native exports are the local verification tools. See the current evidence in `PRODUCTION_AUDIT.md`. Actual Firebase email, local database migration/runtime acceptance, future public hosting, signed installation, native accessibility and physical performance remain outstanding. The database-only Compose configuration has been validated; no database startup or migration was performed during this configuration change.

### 19 October 2026 maintenance verification

The cleanup passes `npm run check`, Expo dependency compatibility, all 21 Expo Doctor checks and Android/iOS/web exports. No tests or CI were introduced. See the latest dated section in PRODUCTION_AUDIT.md for exact scope and limits. Real providers, database runtime and physical devices remain unverified. Mobile still reports 18 high-severity dependency findings; do not describe dependency security as complete.

## 3. Implementation map and invariants to preserve

Use `ARCHITECTURE.md` for the exact route/data inventory. Key entry points:

- Backend: `src/routes/workspace.ts`, `channels.ts`, `messages.ts`, `team.ts`, `auth.ts`, `settings.ts`; `lib/access.ts`, `search.ts`, `messages.ts`, `auth.ts` and `telemetry.ts`.
- Web: `Dashboard.tsx` composes the screen; `chat/useChannelMessages.ts` and `chat/messageState.ts` own chat state; `CreateRoomDialog.tsx` shares the creation form. Other entry points: `WorkspaceDialog.tsx`, `WorkspaceActivity.tsx`, `MessageSearchDialog.tsx`, `ContextDrawer.tsx`, `chat/ChatView.tsx`, `chat/MessageActionsDialog.tsx`, `ProfileModal.tsx`, `SettingsModal.tsx` and `services/api.ts`.
- Native: `DashboardView.tsx` composes the screen; `chat/useChannelMessages.ts` owns chat state and `chat/MessageRow.tsx` renders each row. Other entry points: `WorkspaceManagerModal.tsx`, `MessageSearchModal.tsx`, `ContextDrawerModal.tsx`, `chat/MobileChatView.tsx`, `chat/messageState.ts`, `ProfileModal.tsx`, `SettingsModalView.tsx`, `hooks/use-brutal-theme.tsx` and `services/api.ts`.

Important invariants:

1. Firebase UID identifies the account. Email matching is not legacy account linking. Server verification and current DB membership authorize requests.
2. Private-room access requires actual private membership even for workspace administrators. No global `User.role` shortcut overrides workspace roles.
3. Take the relevant workspace gate and room transaction lock before a room mutation; recheck membership/role after acquiring them. Keep consistent lock ordering. Administrative revocation must not depend on cooperation from a private-room creator: preserve privacy while reassigning to an existing participant or detaching ownership; voluntary leave still requires transfer.
4. Message mutation and durable change record commit together. A sequence number alone does not prove commit order.
5. Page limits bound memory/work, not product history. Keep cursors and routes to the rest of the server data.
6. Do not mark unviewed messages read merely because search, a profile modal or archive paging loaded something.
7. Client mutation ID remains stable for the same uncertain send; changing payload with that ID is a conflict, not a second successful create.
8. Cancel obsolete loads and reject late updates from old workspaces, rooms or sessions. Scope all server state accordingly.
9. No raw request body, query/search text, credential, invitation secret or private message enters general logs.
10. Eight migrations are checked in. New migration deployment requires the direct operator connection; runtime workers do not modify schema on startup.

All new endpoints must use strict Zod schemas, actual authorization scopes and stable errors. Reuse public DTO helpers. Add new request/response TypeScript definitions to both clients in the same change. Platform DTOs remain explicit and local to each client; avoid adding workspace/Metro infrastructure just to deduplicate a small type file. Native imports use `@/types/chat` and `@/services/api` directly, with no barrel indirection.

## 4. Local setup and future release work

These are required to deploy the current text-collaboration scope safely. They are not substitute UI features.

### 4.1 Firebase project and actual email

1. Create/configure the real Firebase project and enable only Email/Password as intended. Set the desired password policy and email enumeration protection in the provider.
2. Fill `frontend/.env` and `mobile/.env` with the public configuration from the same project. Supply the same project ID plus managed Admin identity/secure credentials to the API.
3. Add the deployed domains to authorized domains. Configure verification/reset sender/template/action behavior. Never put Admin credentials in `VITE_*`/`EXPO_PUBLIC_*` variables.
4. Current signup UI accepts a minimum of 12 characters; align the configured provider policy and user-facing guidance deliberately. Stronger future password policy should not unexpectedly reject existing logins. Verification and reset remain Firebase-owned.
5. Manually sign up a real staging account, confirm denial before verification, open the received mail link on another device and log in afterward. Verify expired/used links and resend handling.
6. Reset the password through received email, log in with the new password and inspect old-session behavior. Verify Logout all devices and disabled-account denial.
7. Record the real result/date without passwords, tokens or action codes. Remove emulator values from all production/release environments.

Use [Firebase's user-management APIs](https://firebase.google.com/docs/auth/web/manage-users); do not create an application password/reset table.

### 4.2 Local PostgreSQL and migrations

1. Use the single root `docker-compose.yml` for PostgreSQL 16 only. Root `.env` holds the database container settings and remains ignored by Git. Existing local backend credentials were reused when creating it.
2. Keep the same `fable_postgres_data` named volume. The database port is bound to loopback; clients reach the host API, never PostgreSQL directly. Environment changes do not rotate credentials in an initialized volume.
3. Configure `DATABASE_URL` and `DIRECT_DATABASE_URL` in `backend/.env` for this same local instance. The migration wrapper supports local connections. Neon/pooler settings are unnecessary for the current setup.
4. Start PostgreSQL with `docker compose up -d postgres`. For a fresh or correctly baselined database, apply reviewed migrations with `npm --prefix backend run prisma:deploy`, then generate Prisma. Review existing schema/history before applying the baseline; never reset or erase data to fix setup.
5. Manually verify workspace isolation, private-room permissions, edit conflicts, uncertain-send reconciliation and full-history search against this database with actual verified Firebase accounts.
6. If moving to hosted PostgreSQL later, select region/backup retention, use appropriate runtime/migration roles, verify remote TLS/pooling and rehearse a populated migration/restore. Do not migrate to Neon automatically.

### 4.3 Manually start applications

The application processes run outside Docker. After package installation, environment setup and any reviewed migrations, use separate terminals:

```sh
npm run dev:api
npm run dev:web
npm run dev:mobile
```

Vite serves the web app on port 3000 and proxies `/api` to the Express process on port 5000. Put public web Firebase settings in `frontend/.env`; root `.env` is for PostgreSQL only. Configure a reachable host API URL for a physical mobile device, or leave it blank for Expo development-host detection.

Run `npm run check` for local source verification. Public hosting, HTTPS termination, process supervision, security headers and production operational setup are later decisions. There are no API/web containers or Nginx assets to build or launch in the current repository. Preserve the existing production guards when public hosting is requested.

### 4.4 Mobile signing, persistence and performance

1. Set owned `IOS_BUNDLE_IDENTIFIER`, `ANDROID_APPLICATION_ID` and `EAS_PROJECT_ID` through `mobile/app.config.ts`/the selected EAS environment. Do not invent an already registered namespace.
2. Set production public Firebase config and an HTTPS API URL reachable from a real device. Do not use emulator/localhost URLs in release builds.
3. Run SDK compatibility checks. Build/install preview and production binaries using `mobile/eas.json`, appropriate signing and current store requirements. EAS account/store enrollment is external work.
4. Verify secure session restore after force quit/reboot, logout removal, device locking, repeated token refresh and reinstall behavior on iOS/Android. The storage adapter's source design alone does not prove those OS behaviors.
5. Manually exercise keyboard, safe areas, back navigation, long text, theme, VoiceOver/TalkBack, font scaling, search-result scroll and private membership controls.
6. Profile a release binary on representative low/mid-range and 120 Hz hardware. Measure startup, interaction/frame timing, memory plateau, CPU, battery/thermal behavior and foreground/background recovery.
7. Repeat workspace/room changes and full-history paging; ensure memory plateaus and inactive polling stops. Media-heavy profiling must be repeated if media is later added.
8. Confirm ProMotion/high refresh configuration against the actual binary. The 8.33 ms frame interval at 120 Hz is a budget, not an achieved claim.
9. Record exact device/OS/build/network/dataset and observed results. JavaScript export and Expo browser rendering do not replace installation or native profiling.

### 4.5 Dependencies and operations

The last audit found zero known backend/web dependency findings and **18 high mobile entries**, propagating primarily through Expo/Metro from `braces` and `node-forge`. Do not force the suggested Expo 44 / React Native 0.72 downgrade; it breaks the requested SDK 57 stack.

Review [the braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and [the node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv), then re-run the current registry audit. Prefer a supported upstream compatible release. If no patch exists, document affected build/signing paths and a reviewed, time-bound decision; do not announce a clean security scan or fabricate a patch. Any compatible patch/fork needs dependency/build verification and manual proof of the affected behavior without adding a prohibited test suite.

Set up restricted error reporting and useful host/API/database metrics. Alert on sustained errors, crashes, readiness failure, pool exhaustion and failed backups. Redact user content and credentials. Request logs already have safe IDs but are not a full incident-monitoring system.

## 5. P1: direct messages and small private groups

This is a valuable collaboration feature, but it is not implemented. Do not fake a DM by filtering public-room messages client side.

### Data design

Extend `Channel` with an explicit conversation kind (`room`, `direct`, `group_direct`) or introduce a conversation model with the same scoped message invariants. For an incremental implementation, a conversation kind on Channel avoids a duplicate message engine. Keep room `type` (text/audio/video) separate from conversation kind.

Add a nullable deterministic `directKey` unique per workspace for a one-to-one DM: derive it from the sorted pair of internal user IDs and workspace. Add appropriate membership/kind constraints and indexes. Direct conversations are private, exactly two current workspace members, with no owner role that prevents either from managing notification/visibility. Decide whether leaving is allowed or archive/hide is the UX; do not reuse private-room creator rules blindly.

### API and authorization

1. `POST /api/conversations/direct { userId, clientMutationId? }` validates both current workspace memberships, forbids an unauthorized target, serializes pair creation and returns the existing conversation on repeat.
2. `GET /api/conversations?kind=&after=&limit=50` returns only conversations the caller actually belongs to, with real peer DTO, last-message summary and unread state.
3. Reuse authorized message/history/change/reaction/pin endpoints after making the kind constraints explicit. Do not allow `/channels/:id/members` to add a third participant to a one-to-one DM.
4. Implement a separate group-direct create/membership policy if requested; bound participant count and define who may invite/remove people.
5. On workspace removal, revoke DM access consistently and remove related active subscriptions/cache records. Preserve shared authored content according to retention policy.

### Clients and manual acceptance

Add a paginated Direct messages section in Sidebar/SidebarDrawer, a real Start conversation action on member profiles and a native peer header. Reuse the current bounded chat state. A stale/removed peer should display a truthful inaccessible conversation state. Avoid displaying workspace-directory emails.

Manually create a DM on web, open it on mobile, send both ways, reopen after logout, repeat create simultaneously, verify no duplicate pair, and prove a third workspace member/another tenant cannot discover/read it. Check unread behavior and account removal. Complete both clients before enabling the control.

## 6. P1: threads and replies

### Schema and server rules

Add nullable `parentMessageId` to Message with a self relation and an index such as `(channelId, parentMessageId, createdAt, id)`. Decide on one-level threads initially; the root must belong to the same accessible room and cannot itself be a nested reply. Use a constraint/transactionally verified relationship that prevents cross-room/cross-workspace parents.

Keep a real thread-reply count and latest reply time through SQL aggregation or transactionally maintained values. Do not count only the client's cached replies. Add optional `ThreadSubscription` and per-thread read markers if unread subscriptions are in scope; ordinary room unread semantics need a documented decision for replies.

Implement:

- `GET /api/messages/:rootId/replies?before=&after=&limit=50` with authorized bounded history.
- `POST /api/messages/:rootId/replies { content, codeSnippet?, clientMutationId }`, using the current room gate, idempotency and change feed.
- Message DTO extensions `parentMessageId`, `replyCount`, `lastReplyAt`; root timeline should not duplicate every reply unless product explicitly chooses inline display.
- Edits/reactions/deletes use current author/role/version policies. Root deletion needs an explicit thread policy: tombstone root with accessible replies or purge thread; communicate the consequence before deletion.

### Client behavior

Web uses a thread pane/dialog; mobile uses a dedicated screen or full-height sheet with its own composer and virtualized pages. Preserve main-room scroll/draft/read state. Track reply feed events without injecting replies into the root timeline. Keep independent bounded caches and cleanup on close.

Acceptance: root/replies persist across platforms, equal timestamp ties page correctly, reply counts update, conflicts preserve drafts, inaccessible parents fail, removed membership revokes the thread, and deleted roots follow the chosen policy. Do not enable a Reply icon backed only by local React state.

## 7. P1: attachments, images and voice notes

### Durable storage and schema

Select a private S3-compatible object store or another approved durable storage provider with cost appropriate to the hobby project. PostgreSQL stores metadata and relationships, not large media blobs/base64. Do not make an ephemeral API container filesystem the only durable upload store.

Add `Attachment` with ID, workspace/room/uploader, optional message relation, random object key, original safe filename, expected/detected MIME, size, checksum where used, status (`pending`, `processing`, `ready`, `rejected`), created/expiry timestamps and optional image/audio metadata. Add indexes for pending cleanup and scoped message lookups. Decide allowed formats/sizes and quotas before accepting uploads.

### Upload lifecycle

1. `POST /api/uploads { channelId, filename, contentType, size, clientMutationId }` verifies current room access, quotas and type/size limits, creates pending metadata, then returns a short-lived object-store upload instruction.
2. The client uploads bytes directly or through a streaming bounded endpoint. Never load the whole file into multiple base64/JSON copies. Support cancellation and visible progress from actual transfer events.
3. `POST /api/uploads/:id/complete` rechecks ownership/scope and independently verifies object existence, actual size/type/checksum. Do not trust a client-reported successful upload.
4. Decode/process media safely, generate thumbnail/audio metadata where relevant and scan potentially dangerous content according to the supported formats. An unverified object cannot be attached as ready content.
5. Message creation references ready attachment IDs; confirm same workspace/room and ownership policy, link transactionally and make repeated sends idempotent.
6. `GET /api/attachments/:id/download` rechecks current authorization and returns a short-lived URL. Do not expose permanent public bucket URLs for private content.
7. Purge unclaimed pending objects, rejected files, deleted attachment records and thumbnails through a resumable cleanup job. A shared object should only be removed after all authorized references/lifecycle rules are resolved.

See [S3 presigned upload behavior](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html); provider URLs are capabilities, so avoid logging them or treating their expiry as immediate revocation of a downloaded copy.

### Web/mobile presentation

Use actual file selection and native document/image permission flows. Show filename/type/size, upload progress, cancel, retry, failure and processing status. Request properly resized images with bounded decode/cache sizes. Download/open unsupported types safely; never render arbitrary HTML/SVG as trusted inline content.

Voice notes depend on the same attachment pipeline. Use a currently compatible Expo audio implementation, real microphone permission, duration/size caps, interruption handling and actual waveform/duration metadata. Stop the recording session on cancel/background/route exit. Playback needs genuine loading/error/duration state and resource cleanup. Do not reintroduce timer-generated waveforms or pretend recording indicators.

Acceptance: two real devices upload/download through authorized access, offline cancel/retry is honest, oversized/disguised files fail, revoked users cannot obtain new URLs, orphan cleanup works and repeated navigation releases decoded/recording resources.

## 8. P1: notifications, mentions and unread settings

### In-app notifications and mentions

Add `Notification` with user/workspace, event type, safe resource references, created/read timestamps and a scoped deduplication key. Index `(userId, readAt, createdAt, id)`. If mentions are required, store structured Mention relationships from server-validated current room members, not a regex-based client claim that every matching name should be notified.

Create notification records in the message transaction or a transactional outbox. Respect room access and preferences; do not create notifications for someone outside a private room. Exclude unnecessary message bodies from general notification metadata.

Add bounded `GET /api/notifications`, exact mark-read endpoints and a mark-all-read cutoff, with counts from the server. Add notification preference schema only when delivery uses it. Implement a mobile inbox and accessible web panel with matching deep-link behavior. A count must not be calculated from one cached page.

### Push delivery

Add `DeviceInstallation` (user, installation ID, platform, push token, last seen/revoked time) and notification delivery/outbox records. Register a real device token after an explicit permission/value explanation. Never let a request register another user's token binding.

Use supported Expo push or direct FCM/APNs depending the final native build; validate delivery receipts, remove invalid tokens and make retries deduplicated. Handle token rotation, logout/user switching, opt-out and denied permissions. Separate preview/production delivery environments.

Default payloads should say a new message/activity exists, with resource references; avoid exposing private text on a lock screen without an explicit preference. On open, fetch the authorized resource rather than trusting payload content. A removed member must not keep receiving private content; process membership/notification races deliberately.

Acceptance: real iOS/Android devices receive a real message notification, denied permission remains usable, opt-out persists, logout prevents another account's delivery, deleted/inaccessible destinations recover cleanly, and unread markers do not clear messages merely because push arrived.

## 9. P1/P2: actual realtime and presence

Current bounded foreground polling is usable for a small hobby release. Introduce realtime only when its latency/cost benefit justifies the operational work.

### Transport design

Use an authenticated WebSocket gateway or another supported transport that retains the current durable synchronization model. Browser WebSockets do not offer arbitrary Authorization headers: use a short-lived connection ticket issued through the authorized HTTPS API or another explicit secure handshake, not a long-lived bearer token in a logged query URL.

Subscriptions require server-side workspace/room authorization. Reauthorize on member removal and disconnect/revoke affected subscriptions. Bound subscriptions, inbound messages, outgoing buffers and reconnect attempts. Handle heartbeat expiry and slow clients without holding database connections for every socket.

Events contain scope, resource ID, type, version and cursor. Send only committed events through a transactional outbox/proven delivery mechanism. Multi-replica sockets require a shared broker; a process-local event emitter does not reach subscribers on another replica.

On reconnect, use durable cursor catch-up and resnapshot when retention has expired. Deduplicate versions, preserve archive/live separation and maintain bounded client windows. REST remains the source of truth; a missed socket event must not permanently lose data.

### Presence and typing

Keep presence ephemeral with expiry and foreground activity. Typing indicators contain no draft text, expire quickly and are rate limited. Do not persist every keystroke or keep users permanently online. Treat native backgrounding, abrupt termination and multiple devices explicitly.

Acceptance: reconnect after missed edits/deletes, two tabs/devices, duplicate/out-of-order delivery, membership revocation, server restart and slow/offline clients converge with the database. Then reduce redundant polling while retaining recovery fallback.

## 10. P2: live audio/video and screen sharing

This requires real RTC service infrastructure; the removed screens must not be restored as simulation. A managed service such as LiveKit is a potential implementation choice, subject to compatible SDKs, costs and provider configuration. See [LiveKit Expo setup](https://docs.livekit.io/transport/sdk-platforms/expo/) and [room token grants](https://docs.livekit.io/frontends/reference/tokens-grants/).

### Backend and database

Add `CallSession` with workspace/room, provider room ID, creator, lifecycle state/timestamps and limits, plus minimal participant/audit metadata if needed. Do not use a database row as proof that a microphone is publishing or a peer is connected.

Implement `POST /api/calls { channelId, mode }` and `POST /api/calls/:id/token`. Under current room access and call policy, issue a short-lived provider token bound to the exact room/internal user identity and appropriate publish/subscribe grants. Provider API secrets remain backend-only. Avoid granting room-admin capabilities to ordinary participants.

Validate signed provider webhooks and deduplicate events before updating lifecycle state. Restrict room lists and participant metadata by actual membership. When access is revoked, remove the participant at the provider as well as disallowing new join tokens; token expiry alone does not necessarily disconnect an existing session.

Decide who may end a room, participant capacity, recording consent, retention, moderation and billing quotas. Keep recording disabled until a real consent/storage/delivery design exists.

### Web and native clients

Use actual track publication/subscription, permission prompts, device routing and provider participant state. Render real active speakers and video tracks. Support mute/camera on/off, reconnect, denial, interruption, leave and error recovery. Use adaptive subscriptions and avoid decoding invisible video tiles.

Expo requires the supported native integration/config plugins and a new development/release binary; WebRTC modules are not validated by Expo Go or a JS export. Verify the current SDK 57/New Architecture compatibility before choosing package versions. Clean up audio sessions/tracks on exit/background according to the policy.

Screen sharing has separate web/iOS/Android capabilities and native permissions/extensions. Document each supported platform and show availability honestly. Do not offer a universal button with no implementation. Media device preferences may return only when the actual SDK consumes them.

Acceptance: actual two-device audio/video, speaker/headset/Bluetooth routing, background/interruption behavior, join after membership removal, provider outage, reconnect and release-device memory/battery/thermal profiling. Do not call encryption-in-transit end-to-end encryption unless the specific media E2EE design is implemented and verified.

## 11. P1/P2: account lifecycle, privacy and safe administration

### Account deletion and data export

Add authenticated recent-login checks using verified Firebase `auth_time` or an equivalent documented reauthentication flow. Define whether shared authored messages remain attributed, are anonymized or are removed; do not cascade away a workspace's history accidentally.

Deletion is a resumable lifecycle across Firebase, PostgreSQL and future storage/push providers. Add `AccountDeletionRequest`/application lifecycle state if needed, prevent new activity after confirmation, revoke sessions, transfer owned workspaces/rooms or explicitly block until transfer, purge/anonymize selected personal data and reconcile Firebase deletion. Keep minimal required audit records safely. A provider failure must be retried/visible, not silently treated as total success.

Export is an authorized, bounded job with clear scope and retention. Add status/download endpoints and a short-lived private download; never bundle other members' private data into an account export by querying an entire workspace. Avoid large exports in an API request or unbounded memory.

Both clients need clear consequence text, recent-login/password reauthentication where appropriate, progress/failure recovery and a final sign-out state. Do not ship an Account deleted message before the lifecycle outcome is confirmed.

### Workspace lifecycle and moderation

Add archive before permanent workspace deletion when product scope supports it. Owner-only deletion must require typed confirmation, prevent new writes, handle invitations/jobs/storage/DMs/notifications and preserve retention commitments. Restore is a separate bounded policy, not a fabricated Undo button.

For community/untrusted-user use, add reporting, moderation queues, rate/size quotas, blocks where meaningful and restricted audit access. Do not claim public-community readiness based only on a small trusted-team workspace.

### Invitation email and onboarding

Current manual tokens work. Automatic invitation mail needs an approved provider and a durable outbox with deduplication, sender/domain setup, failure/retry status and no leaked raw tokens in logs. Raw invitation secrets are currently not recoverable from their hashes: either generate/encrypt a delivery payload briefly with a clear retention policy or create/send the invitation as one controlled workflow. Do not “retrieve” the hash as if it were the secret.

Use a secure app/web join destination, verify intended email, handle already-member/expired/revoked states and clear secrets from browser history where applicable. Do not make invite acceptance a login or bypass email verification.

Provide useful first-run empty states (create room, invite real teammate, join real workspace), concise help and real account settings. Avoid seeded demonstration conversations to make onboarding look populated.

## 12. P2: scale, retention and cost work

### Change-feed retention

MessageChange grows indefinitely today. Add a documented retention horizon, bounded cleanup job and a per-room retained floor cursor. A client whose cursor predates the floor must receive a resnapshot-required response; never quietly omit older changes and claim successful synchronization.

Maintain a consistent snapshot/checkpoint pair while compacting. Keep tombstone/read-cursor needs separate from feed event retention. Add operational metrics for rows/age, query latency and cleanup failures. Validate catch-up after a long-offline client using a manual scenario.

### Directory/search costs

Current directory substring queries and exact totals may become expensive for large workspaces. Measure plans/data volume first. Add useful trigram/indexed search or alternate count semantics only with a documented API/UI change. Avoid installing a hosted search engine before PostgreSQL indexing is insufficient.

Message search currently matches `simple` lexemes with AND semantics and newest-first ordering. Future improvements can include author/date filters, phrase search, language configuration, snippets and ranked results. Keep authorization in the database query, opaque filter-bound cursors and bounded statement times. Do not rank global private results then filter in JavaScript.

### Jobs and idempotency

Introduce a minimal worker and `OutboxJob` (type, scope, payload reference, dedupe key, attempts, next-attempt time, status, safe error category) when important external actions exist. Claim jobs with transactional locking/SKIP LOCKED where appropriate, bound batches, use retries with jitter and expose exhausted jobs to an operator.

Current message-create keys live with messages and protect only that operation. Add dedicated idempotency records for uploads/payments/external mutations when needed, with scope/fingerprint/result/retention. Do not assume a UUID alone makes an operation idempotent.

### Hobby cost controls

Use one region, one API replica and small bounded pools initially. Avoid unnecessary always-on jobs and foreground polling from inactive screens. Measure Neon cold/warm latency before disabling scale-to-zero. Set storage/egress/media/notification quotas and budget alerts before enabling heavy uploads or RTC. Prefer explicit product limits to a surprise bill or a silent data truncation.

## 13. Product improvements to consider after core release

These are potential additions, not current requirements or implemented features:

| Improvement | Implementation direction |
| --- | --- |
| Structured mentions and saved messages | Validated user/resource relations, paginated personal saved collection, no fake local counts. |
| Rich text/code composer | Safe structured content schema and sanitizer; preserve plaintext/accessibility/export fallback. |
| Notification controls | Real per-room mute/read preferences used by delivery, not decorative toggles. |
| Better public routes/deep links | Stable workspace/room/message links with authorization and missing-resource recovery on both clients. |
| Draft persistence/offline reading | Scoped limited encrypted/private caches, expiry/deletion policy and clear cached/pending indicators. |
| System theme | Add a stored `system` mode and device/browser preference listener with clear precedence; migrate the current two-value schema intentionally. |
| Locale/timezone preferences | Shared formatting rules, translatable strings and DST-safe timestamps; never change server chronological order. |
| Accessible keyboard shortcuts | Discoverable web shortcuts, focus-safe behavior and equivalent native actions. |
| Channel archive/bookmarks | Explicit lifecycle/personal bookmark relations, discoverability, retention and bounded lists. |
| Scheduled messages | Durable due-time jobs, idempotent send, author/current-room permission recheck and visible scheduled state. |
| Integrations/webhooks | Per-workspace scoped credentials, signed delivery, retries, rotation and abuse limits. |
| Optional AI summaries | Explicit opt-in, authorized bounded context, privacy/provider decision, costs and clear generated attribution. Never send private workspace data to a model by default. |
| Billing/paid tiers | Only if product needs it: provider-verified webhooks, entitlements, exact amounts and safe retry/reconciliation. |

Discuss scope before adding expensive/external features. None of these should displace security, data integrity, accessibility or core usability.

## 14. Practical implementation workflow without tests or CI

For each selected feature:

1. Read the relevant current routes/schema/client components and record a precise shared contract.
2. Add an additive reviewed migration when persistence changes. Document baseline/upgrade/lock consequences; do not run it against production implicitly.
3. Implement database invariants and transactionally rechecked authorization first. Use actual services and safe failure states.
4. Add API adapters/types on both clients, then finish both user journeys with accessible loading/empty/error/offline states.
5. Retain cancellation, pagination, scoped caches and mobile virtualization. Update design tokens instead of adding unrelated inline styling.
6. Run local generation/build/type/lint/schema checks. Export both native platforms when native/config dependencies change. Do not create tests, workflows or fixtures.
7. Perform a manual real-service walkthrough in staging when available; include negative permission and conflict cases. Record missing access as unverified.
8. Review the final combined code, remove dead UI and update architecture, parity and readiness notes. Hand off concrete evidence rather than a claim that a button exists.

Useful commands from the repository root:

```sh
npm run check
npm --prefix backend run typecheck
npm --prefix frontend run typecheck
npm --prefix mobile run typecheck
npm --prefix mobile run lint
```

Schema and native commands from their directories:

```sh
# backend; validates schema without applying migrations
npx prisma validate

# mobile; exports JavaScript, not signed binaries
npx expo install --check
npx expo-doctor
npx expo export --platform android --platform ios --max-workers 2
```

Dependency audits are read-only release information, not automatic downgrade instructions. No command in this handoff authorizes a production reset, destructive schema synchronization, external publishing or sending messages to users.

## 15. Manual acceptance matrix for the current app

Record each row as passed on a named environment/device, failed with evidence, or unverified. The table itself does not claim execution.

| Journey | Manual checks |
| --- | --- |
| Signup/login/reset | Received mail, pre-verification denial, expired links, verified session, reset/new password, disabled/revoked identity. |
| Workspace discovery/recovery | Later pages/search, saved selection, revoked selection, zero memberships, create/join without tenant access. |
| Roles/removal | Owner/admin/member permissions, owner transfer, channel creator safeguards, last-workspace self-leave, removal revokes actual data access. |
| Invitations | Real token sharing, intended email, duplicate pending invite, expiry, revoke-vs-accept, no secret in listing/logs. |
| Private room | True roster/candidates, unauthorized admin denied, add/remove/leave, creator transfer, typed deletion, foreign IDs rejected. |
| Messages | Cross-platform create/read/edit/delete/reactions/pins, failed draft retained, duplicate uncertain send, stale version conflict. |
| History/search | Beyond cached windows, before/after ties, exact older match, independent pins, removed cursor rows, lexical search/private isolation. |
| Synchronization/read | Remote archive edits/deletes, membership revocation, multiple devices, unread remains until actually viewed, foreground/resume. |
| Profile/theme/activity | Real persisted changes on both clients, off-page authors, theme contrast, owner/admin audit only and bounded pages. |
| Accessibility/native | Keyboard/focus/back, VoiceOver/TalkBack, scaling, safe areas, long text, reduced motion, secure session lifecycle. |
| Release | Correct secrets/domains/TLS, final containers, migrations/restore, signed install, dependency review, monitoring and device performance. |

Finish the current release matrix before calling the deployed text application production ready. Treat future feature proposals separately from release blockers. When reporting progress, state which code was implemented, which environment actually verified it and which work remains.
