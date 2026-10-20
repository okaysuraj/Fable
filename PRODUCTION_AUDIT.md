# Fable production readiness — current status

## Compact mobile drawer and coordinated motion — 20 October 2026

The mobile navigation drawer now uses about 74% of phone width, normally 240–288 logical points, rather than nearly the full viewport. Tablets cap at 288; at least 72 points remain visible. The chat translates left with the revealing panel through one shared animation value. Opening uses a 300 ms ease-out; closing takes up to 220 ms, adjusted for drag distance. The backdrop dims to 12%. Grabbing the panel during opening starts from its current position, and cancelled drags restore both surfaces together. The modal renders outside the translated content and begins opening on presentation. Existing actions, dismissal routes, read-marker pause and reduced motion remain.

Final-source verification passed: mobile strict TypeScript, Expo lint with no warnings, targeted Prettier and Git whitespace checks, and Android Expo export (1,790 modules / 4.6 MB Hermes bundle). Export artifact: `C:\Users\Suraj\AppData\Local\Temp\fable-mobile-push-drawer-4646fffbb91e4dd39e4a1842ee676fda`. No dependencies, backend or web source changed and no test/CI files were added.

Physical-device visual, gesture, accessibility and frame-timing acceptance remain manual. The width/easing choices are not evidence of improved retention. See DESIGN.md for the acceptance walkthrough and rationale.

## Mobile right navigation drawer — 20 October 2026

Status: implemented in the mobile client only, as requested. The three-dot account disclosure is replaced by a hamburger opening a right-side modal drawer. A left swipe from the right edge also opens it. Swipe right, backdrop, close, Android Back and accessibility escape dismiss it. The panel uses the existing Gesture Handler/Reanimated/Worklets dependencies, safe-area handling and reduced motion. Existing profile, directory, group, settings and logout actions are connected; conversation search/details move into the drawer. Selecting a search result/new chat opens the conversation, and Back to chats returns to Messages. Conversation read advancement pauses while navigation covers it. The avatar null fallback is preserved.

Verification on the final mobile source:

- `npm --prefix mobile run typecheck` passed.
- `npm --prefix mobile run lint` passed with no errors or warnings.
- `npx expo export --platform android --output-dir <temporary directory>` passed: 1,790 modules and a 4.6 MB Hermes bundle. Final output is `C:\Users\Suraj\AppData\Local\Temp\fable-mobile-drawer-verified-ecbd1ac336364bd6b8c81402239d71a0`.
- Targeted Prettier and Git whitespace checks passed.

No web source, dependency versions, backend contracts, database data, tests or CI were changed for this request. A native binary/device was unavailable, so gesture recognition, system gesture navigation conflicts, screen-reader focus, large text, rotation and actual modal transitions require the manual walkthrough in DESIGN.md. A JavaScript/Hermes export does not prove those device interactions.

## Local-first messenger expansion — 20 October 2026

Status: substantial source implementation, **incomplete iMessage parity**. The actual scope and outstanding features are recorded in `FEATURE_PARITY.md`. Existing user work, Firebase production identity, development identity, database data/volume and the no-tests/no-CI preference were preserved.

Implemented across the API/web/native source: fixed-membership private direct pairs, chronological activity-based chat ordering/previews, quoted replies, emoji entry and expanded reactions, expiring typing leases, persisted read receipts, bounded protected attachments, voice recording/playback, native video playback/file sharing and foreground one-to-one WebRTC calls. The call overlay pauses read advancement. Message sends remain versioned/idempotent; uncertain upload responses reconcile to the same unbound asset using a scoped digest. A selected media preview replaces the prior preview, and native downloads have cancellation/deadlines and cache cleanup.

Local verification evidence:

- `npm run check` passed on the final combined source: formatting, Prisma schema validation/generation, API TypeScript build, web TypeScript/Vite production build, mobile strict types and Expo lint with no warnings. Web dashboard chunk is approximately 98 kB / 27 kB gzip; browser recording worklet is a separately served runtime asset.
- `node --check frontend/public/audio-recorder-worklet.js` and `git diff --check` passed. The AudioWorklet is production recording code, not a test harness.
- `npx expo export --platform all` passed for Android/iOS Hermes and Expo web. Final bundles are in `C:\Users\Suraj\AppData\Local\Temp\Fable-messenger-final-exports`. These are JavaScript/asset exports, not signed native builds or proof of native WebRTC operation.
- `npx expo install --check` passed after installing SDK-compatible Audio, DocumentPicker, FileSystem, Sharing, Video and Asset modules. React/React Native/Expo major versions were preserved. `react-native-webrtc@155.0.1` and `@config-plugins/react-native-webrtc@15.0.2` are pinned. `npx expo-doctor` reports **20/21 checks**, with the visible React Native Directory warning that WebRTC is untested on New Architecture. It was not suppressed. The config plugin's published version table does not establish SDK 57 device compatibility.
- `npx expo config --type introspect --json` resolved the native mods and confirmed both camera and microphone usage descriptions. This validates config-plugin output without claiming a compiled native binary. The final permission-copy update and `app.config.ts` formatting were checked separately.
- Mobile `npm audit` reports **19 high, zero critical** findings. The newly listed config-plugin finding is propagated through its Expo peer; npm's offered fix downgrades the plugin to 3.0.0, which is inappropriate for this SDK. No forced SDK/native downgrade was performed. Existing Expo/React Native/Reanimated/Worklets findings remain open for a compatible dependency review before any public release.
- Docker PostgreSQL readiness, local identity lookup, conversation directory, message history and presence endpoints returned real records successfully. No fictional contacts, calls or media messages were inserted for the review. Two-person direct/media acceptance was not performed with the single configured development identity.
- Four additive migrations were applied through the verified local `fable_development` connection. A full database backup was taken first at `C:\Users\Suraj\AppData\Local\Temp\Fable-before-messenger-20261020.dump`. Twelve migrations now exist in source. No database reset or legacy/public-schema migration was performed. On Windows, Prisma generation required stopping the running API and its watcher child to release the query-engine DLL; the API was restarted after final checks.
- Headless Edge desktop/phone screenshots were available for visual inspection. Automatic approval review rejected launching Edge with a debugging port with the reason **blocked by policy**. Interactive browser verification remains outstanding; no approval bypass was attempted.

Remaining release blockers: physical native build/installation and two-person media verification, the WebRTC architecture warning, cross-network TURN acceptance, foreground/background and audio-focus checks, push/native incoming-call integration, and the many pending product features in the coverage matrix. There is no end-to-end encryption implementation: PostgreSQL holds application content. Uploads have bounded local storage and signature checks, but public-hosting image transformation, scanning and unattended retention cleanup remain unfinished. Native toolchain, signing/device access and provider credentials were unavailable. No production-readiness claim is made.

## Shared brand and conversation font - 20 October 2026

Status: implemented on web and native. Instrument Serif Regular, already used by the landing footer, now applies to Fable wordmarks, chat headings/names, authors, message text and the composer. Message search, pin content and editing use the same treatment. Main conversation text is 18px with approximately 25px line height. Controls/metadata remain system sans-serif and code remains monospace; colors, real-data behavior, authorization and the two-column layout are preserved.

Web declares the font globally and preloads it in `index.html`; direct app/login visits no longer depend on loading the landing stylesheet. Native bundles the identical 70,012-byte licensed font and loads it through the existing Expo Font module before showing routes. Font-loading errors also release the splash screen. The native landing footer now reuses the shared brand component.

Verification:

- Web strict TypeScript and production Vite build passed with `npm --prefix frontend run build`.
- Mobile strict TypeScript and Expo lint passed.
- Android/iOS Hermes exports passed to a new system temporary directory and both exports include `InstrumentSerif-Regular.ttf`. This is bundle/asset evidence, not an installed-device rendering check.
- Root source formatting and git whitespace checks passed. Web/native font SHA-256 hashes match; source and SIL OFL license notices accompany both copies.
- Live Vite reads returned HTTP 200 for `/app`, `/welcome`, `/login` and the 70,012-byte font. These are serving checks, not browser interaction checks.

No dependency, backend, database, auth policy, test file or CI workflow was changed. Browser automation remains unavailable after the earlier environment policy rejection. Font baselines, multilingual fallback, keyboard input, text scaling and light/dark appearance still require browser/device walkthroughs; DESIGN.md records the manual scope.

## Public landing redesign - 20 October 2026

Status: implemented and verified with the web production build, source formatting, whitespace checks and live HTTP asset reads. The landing page now has its own paper/forest/cobalt/lime identity, locally licensed Instrument Serif headlines, original conversation sculpture, interactive feature tour, FAQ and real signup/login/app destinations. `/welcome` remains public during session loading and errors. Signed-in `/` continues to open the existing messenger. Marketing code and CSS are loaded separately.

| Area                         | Behavior                                                                                                                         | Evidence / boundary                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Entry and conversion         | Actual existing routes; explicit development entry behavior retained; `/welcome` always accessible                               | Web strict TypeScript/Vite build passed; `/welcome`, its tour URL and `/app` returned HTTP 200; rendered route interactions remain manual |
| Feature tour                 | Conversations/search/pins tabs with arrows/Home/End, URL selection, valid tab/panel references and clearly labeled illustrations | Source semantics checked and production compilation passed; keyboard/screen-reader walkthrough remains manual                             |
| Assets and responsive design | Original SVG, 70KB locally bundled serif font with SIL OFL/source notice, responsive breakpoints and reduced motion              | SVG XML and font signature validated; artwork/font/license HTTP reads returned 200; rendered widths and devices remain manual             |
| Scope                        | No fictional records, testimonials, unsupported product controls or claimed award                                                | Existing API/native behavior, dependencies and database unchanged; no tests, fixtures, harnesses or CI added                              |

`npm --prefix frontend run build`, root `npm run format:check` and `git diff --check` passed. Production landing CSS is 22.58KB (5.33KB gzip), and its separate JavaScript is 13.50KB (4.11KB gzip). Selected source-color contrast ratios were 13.08:1 for page text, 5.55:1 for supporting copy, 6.29:1 for the primary CTA and 10.85:1 for the closing CTA. These samples do not establish complete rendered accessibility conformance.

Browser automation remains unavailable after the environment's earlier policy rejection; no workaround or browser/device visual review is claimed. Manual steps are recorded in DESIGN.md. Build and HTTP success do not establish visual quality, real Firebase email delivery, production deployment or improved conversion.

## Dark-mode text visibility correction - 20 October 2026

The web theme host now sets its text color from its own ink token. Previously, unlabeled text inherited the body element's resolved light-mode ink even when the dashboard's variables and surfaces switched to dark mode. This affected ordinary message text, menus and dialog copy. Selected reaction hover now uses a paired light/dark surface, and code-copy hover keeps readable text. Native profile/message errors, edit/delete conflict copy, development-login errors and notice text now explicitly use their palette colors.

Verification: the web production build, native strict type check/lint, repository formatting and whitespace checks passed. Source-color calculations covered 16 normal-text combinations across both themes; the lowest checked ratio was 4.67:1 in light mode and 5.38:1 in dark mode. These checks do not certify every rendered state. Browser automation remains unavailable following the earlier policy rejection, so browser/device visual and assistive-technology review remains manual. No theme preference, API contract, database, dependency, test file or CI workflow was changed.

## Compact edge-to-edge web refinement - 20 October 2026

Status: implemented and verified by the web production build (strict TypeScript and Vite), repository formatting and whitespace checks. The browser shell now has zero outer padding, margin, border, radius or maximum width. Headers are 60px and chat rows have a 64px minimum, with smaller avatars, gutters and message spacing. The two-column messenger direction remains current.

| Area            | Web behavior                                                                                                                                 | Verification boundary                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Viewport        | Full browser width/height; visible-viewport sizing for keyboard and browser chrome; normal pinch zoom retained                               | Production compilation passed; browser keyboard/zoom walkthrough remains manual            |
| Phone layout    | Full-width chat list or conversation, compact header, safe-area padding, 16px inputs and bounded scrollable dialogs                          | Source/layout rules checked; physical devices and rendered responsive widths remain manual |
| Message actions | One reachable options button replaces the always-visible reaction toolbar; the existing dialog offers real reactions and permitted mutations | Type checks passed; live interaction and error recovery walkthrough remains manual         |

No API contract, database, native code, dependency, test file or CI workflow was changed for this refinement. Existing authentication, drafts, visibility-aware read markers and authorization remain in place. The earlier environment rejection of browser automation still limits rendered visual evidence; no browser/device review is claimed. DESIGN.md contains the manual review steps.

## Everyday messenger redesign - 20 October 2026

Status: implemented; the user's latest request supersedes the three-column screenshot below. The current design uses one chat list and one wide conversation, system typography, neutral surfaces and blue outgoing bubbles. Visible vocabulary is chats, people and groups. Hidden phone conversations retain drafts while suspending read acknowledgements, so viewing the list does not clear unseen messages. See DESIGN.md for the current contract. The earlier screenshot report is historical.

| Journey                 | Web                                                                                      | Native                                                                                                                   | Evidence / boundary                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Conversation navigation | Single list with search, account options and a secondary group picker; wide message pane | Virtualized single list; two columns at tablet widths; full-screen list/conversation on phones with Android back support | Strict compilation and live authorized directory reads passed; rendered navigation remains manual |
| Start a chat            | Focused creation dialog with real visibility explanation                                 | Focused creation sheet using the existing authorized endpoint                                                            | Source contract preserved; interactive creation walkthrough remains manual                        |
| Message actions         | Hover/focus actions, real history/search/pins, retained drafts and multiline composer    | Existing reaction summaries; reactions and mutations in the message sheet, virtualized history and retained drafts       | Build/types/lint and Android/iOS exports passed; device interaction remains manual                |
| Account/appearance      | Profile, people, settings and group management in secondary menus                        | Same authorized features behind options and Groups                                                                       | API profile/settings reads succeeded; light/dark tokens and existing persistence remain           |
| Assets                  | System font stack and authored blue SVG favicon                                          | Built-in platform font faces and regenerated blue launch/icon assets                                                     | No custom font files or font-loading gate; deterministic brand exporter retained                  |

Verification for this update:

- Web production build passed (TypeScript and Vite).
- Native strict TypeScript and Expo lint passed. Android/iOS Hermes bundle exports passed under a new system temporary output directory. These are JavaScript bundle checks, not signed installation evidence.
- Repository formatting and git diff whitespace checks passed.
- Live API reads for the current profile, group directory, chats, people and settings returned HTTP 200. Running Vite returned HTTP 200 for the application, updated Dashboard source, stylesheet and favicon.
- Selected source-color contrast: white outgoing text 5.27:1, light metadata on white 5.22:1, light metadata on the sidebar 4.71:1, dark metadata 7.68:1 and light composer boundary 3.48:1. These samples are not a complete rendered accessibility audit.
- No dependency versions, API contracts, schema or migrations changed for this design update. Existing development authentication, PostgreSQL data and application startup processes were preserved. No test suite, fixture, test-only dependency or CI workflow was added.

Browser automation is still unavailable because the environment approval review rejected the earlier headless launch as blocked by policy. No bypass was attempted. Browser screenshot comparison, keyboard/screen-reader review and physical native device interaction remain manual; no production-readiness claim is made.

## Screenshot-based interface redesign - 20 October 2026

Status: implemented and verified through local compilation, lint, schema checks, asset serving and native bundle exports. The user supplied a chat screenshot as the final visual reference. The interface now uses a rounded translucent shell, light cyan/lavender surfaces, separate profile/navigation and conversation-card columns, locally bundled Plus Jakarta Sans and purple own-message bubbles. DESIGN.md documents the current reference, palette and interaction contract.

| Journey                            | Web implementation                                                                                                                         | Native implementation                                                                                                | Evidence / limits                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace and directory navigation | Profile navigation, separate room/people cards, real workspace selector, current-directory top search, keyboard palette and phone drawer   | Existing virtualized room/people drawer with updated typography, surfaces and touch controls                         | Strict compilation and lint passed; live authorized directory endpoints returned 200. Browser/touch walkthrough remains manual.                           |
| Conversation and history           | Received/own bubbles, real timestamps, grouped authors/dates, retained history controls, auto-sizing composer and existing message actions | Current-user bubble alignment, virtualized message history, multiline native composer, reactions and message actions | Web build and Android/iOS exports passed. No mock conversations or invented last-message previews were introduced.                                        |
| Preferences/profile/recovery       | Persisted light/dark theme preview controls, revised dialogs/forms, profile navigation and accurate empty/error states                     | Shared light/dark tokens, loaded static font weights, corrected dark status bar and matching dialogs                 | Local development appearance was saved as light through the existing API and confirmed by subsequent reads. Other users were not changed.                 |
| Brand and assets                   | Plain geometric wordmark, SVG favicon and local WOFF2 fonts with preload/swap                                                              | Updated launch/icon PNGs from authored vector geometry and four bundled TTF weights                                  | Asset HTTP reads returned 200; native exports included the font assets. Reproducible Windows brand exporter and font source/license notices are included. |

Final verification:

- Root `npm run check` passed: formatting, Prisma validation/client generation, backend build, web production build, mobile strict TypeScript and mobile lint. The API watcher child was briefly paused for Windows' Prisma DLL lock and restarted through the same watcher afterward.
- Android and iOS Hermes exports passed with `npx expo export --platform android --platform ios --max-workers 2`, with output under the system temporary directory. These are bundle checks, not signed installations or device performance evidence.
- The running Vite server serves the new workspace layout, local font assets and SVG favicon. Local API profile, room, people and appearance reads succeeded.
- Selected source-color contrast calculations: main text 14.87:1, metadata 4.85:1, outgoing-message white text 6.13:1, primary-action text 6.33:1, dark metadata 7.01:1 and light input boundary 3.15:1. These samples do not certify every rendered state or full accessibility conformance.
- `git diff --check` passed. No dependency versions, API contracts, database schema, test suite, fixtures or CI workflows were added for the UI redesign. The earlier authorized development-authentication changes remain intact.

Browser automation remains unavailable after the environment's approval check blocked the headless browser launch with “blocked by policy.” Final screenshot comparison, responsive keyboard/screen-reader review, physical-device interaction and signed installation remain unverified. The reference's sample contacts, message text, schedule and dashboard actions were not copied into runtime content; the app displays its real authorized rooms and users.

## Firebase-free development - 20 October 2026

Status: implemented and verified through local builds and the running API. The user requested local testing without Firebase. Explicit development flags now select one server-configured, PostgreSQL-backed identity on web and mobile. Both clients open it automatically and offer **Continue in development** after logout. No password, email verification, emulator or Firebase credentials are required in this mode. Firebase remains the production identity provider.

| Capability                | API                                                                                                | Web                                                           | Mobile                                                                     | Current evidence                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Development entry         | Existing atomic `/auth/session` provisioning; namespaced identity selected by server configuration | Automatic session creation; password-free return after logout | Automatic account recovery/provisioning; password-free return after logout | Real API provisioning and repeat-session identity passed; client builds/types/lint passed.                                                       |
| Account/workspace content | Existing PostgreSQL account, workspace, room and message authorization                             | Same authorized records via existing transport                | Same authorized records via existing transport                             | Profile/workspace/general-room reads, message create/read/delete and foreign-workspace denial passed.                                            |
| Session controls          | Development device revocation returns 409                                                          | Ordinary logout clears local state; revocation control hidden | Ordinary logout clears local state; revocation control hidden              | API refusal verified; browser/device interaction remains manual.                                                                                 |
| Production boundary       | Bypass startup refused outside `NODE_ENV=development`; development marker refused when disabled    | Development mode requires Vite `DEV`                          | Development mode requires native `__DEV__`                                 | Production startup refusal and disabled-mode HTTP 401 verified; production web marker/control absent; Android/iOS release bundle exports passed. |

Ignored local environment files have all three development flags enabled. The running API was restarted through its existing development watcher; the running Vite server was confirmed to have loaded its public flag. Future environment changes require process restarts, including Expo. Optional API `DEV_AUTH_EMAIL` / `DEV_AUTH_NAME` customize the account; users of the same development API share that identity. Use only a trusted development network.

Database inspection found unmigrated legacy tables in `public`. Rather than altering those records, both local API database URLs now select `schema=fable_development`, where the eight existing migrations were applied successfully. The container, volume and existing `public` data were preserved. Read-only before/after counts match: 1 account, 6 users, 5 channels, 8 messages, 15 reactions and 1 settings record. The new local development account has its own workspace/general room. The temporary connectivity message was deleted through the normal API; the development room has zero live messages.

Verification on Windows / local PostgreSQL:

- `npm run check` passed: formatting, Prisma validation/generation, API build, web production build, mobile strict types and mobile lint. The first generation attempt encountered the running API's Windows DLL file lock; pausing its watcher child, rerunning the full command and restarting through the same watcher resolved it.
- Existing migrations deployed successfully to the separate `fable_development` schema; no migration source or table definitions were changed.
- Running API walkthrough passed: missing marker 401, session provision/reuse, profile/workspace/general-room reads, invalid workspace 403, real message create/read/delete and unsupported device revocation 409.
- With the bypass disabled, the real HTTP app rejected its public marker with 401 without initializing Firebase. A separate production-config check rejected startup with the bypass enabled.
- Production web output contains neither the development bearer marker nor **Continue in development**.
- Android/iOS Hermes exports passed using `npx expo export --platform android --platform ios --max-workers 2` with output under the system temporary directory. These are JavaScript bundle checks, not signed installations or device verification.
- `git diff --check` passed. No test suite, fixture generator, test dependency or CI workflow was added.

The environment's approval check blocked a headless browser launch with “blocked by policy”; browser interactions and physical-device checks remain manual. Firebase verification/reset delivery and production deployment remain outside this local development verification. Earlier evidence below is historical and does not supersede this section.

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

| Check                                                                                                                 | Result and scope                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check` at root                                                                                               | Passed: format, Prisma schema validation/generation, backend build, web production build, mobile strict types and mobile lint.                                                                                                                           |
| `npx expo install --check` in mobile                                                                                  | Passed: dependencies are up to date for SDK 57.                                                                                                                                                                                                          |
| `npx --yes expo-doctor` in mobile                                                                                     | Passed: 21/21 checks.                                                                                                                                                                                                                                    |
| `npx expo export --platform android --platform ios --platform web --max-workers 2 --output-dir <temporary-directory>` | Passed: Android/iOS Hermes bundles, web bundle and three static routes. Output is outside the repository.                                                                                                                                                |
| Read-only route/source review                                                                                         | Same 43 route declarations. 39 route-handler syntax trees match the pre-cleanup baseline after normalizing moved helper names. Four message handlers now call the typed mutation service with an operation field. No new checked-in harness was created. |
| `git diff --check`                                                                                                    | Passed.                                                                                                                                                                                                                                                  |
| Final source/lockfile review                                                                                          | Every remaining TypeScript application module is reachable from an app entry point; application manifests match their lockfiles. No source test files were found.                                                                                        |

The initial baseline also passed its existing build/type/lint checks. Source copies and removed/generated directories were retained locally under `C:\Users\Suraj\AppData\Local\Temp\fable-maintenance-BPFJMW` to make this cleanup reversible; this is temporary local recovery material, not a durable project backup.

### Remaining verification

No real Firebase email delivery, authorized cross-client database journey, container rollout, signed installation or physical-device accessibility/performance walkthrough was performed. Recheck verified login, workspace switching/revocation, message send/edit conflicts, exact search navigation, history/pin paging, profile/theme persistence and native background/resume against staging before release. Build/export success does not certify those flows.

The mobile installer still reports 18 high-severity dependency findings. Their resolution remains existing release/security work; this cleanup did not use a forced audit fix or claim those findings are resolved. Keep the historical audit evidence below separate from the current static/build evidence.

---

Updated: 14 October 2026.

**Core text-collaboration implementation is substantially complete. Full production release is not signed off.** The actual backend remains Express/TypeScript/Prisma, as the user requested. No live Firebase/Neon account, production migration, external hosting deployment or signed native distribution was performed.

Use [ARCHITECTURE.md](ARCHITECTURE.md) for the current implementation and contracts, and [GEMINI_HANDOFF.md](GEMINI_HANDOFF.md) for exact release tasks and future feature plans.

## Current implementation and parity

| Area                 | Web and mobile behavior                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication       | Firebase email/password, signup mail verification/signout, verified-only access, resend/reset links, session restore and local logout.                                     |
| Account              | Real profiles/status, account-backed appearance and confirmed all-device revocation.                                                                                       |
| Workspaces           | Paged discovery/search/switch, create/rename/join, owner/admin/member management and recovery after revoked memberships.                                                   |
| Ownership/removal    | Owner transfer and protected self-leave; administrative removal succeeds without private creator cooperation and preserves privacy/content.                                |
| Invitations/activity | Hashed email-bound one-use tokens, manual sharing, paged statuses/revocation and actual administrator activity.                                                            |
| Rooms                | Real public/private rooms, paged roster/candidates, add/remove/leave, metadata/creator transfer and exact-name deletion.                                                   |
| Messaging            | Real persisted text/code, reactions, independent pins, versioned edits/deletes, retained failed drafts and idempotent uncertain create retries.                            |
| History/search       | Complete cursor-accessible server history, Earlier/Newer/Latest, full-text authorized search and exact centered result opening.                                            |
| Unread/sync          | Durable bounded change feed, monotonic read markers, archive isolation and authoritative counts after read acknowledgments.                                                |
| UX/performance       | Applied light/dark tokens, focus-managed forms/dialogs, native virtualized pages, reduced motion, background polling suspension, route splitting and request cancellation. |

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
