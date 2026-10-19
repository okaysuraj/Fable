# Fable web audit - 14 October 2026

> Historical audit evidence. Current web now includes workspace/room administration, invitations/activity, full-history search, real theme application, route splitting and cancellation. Automated tests/CI were removed at the user's request. Refer to ../ARCHITECTURE.md, ../GEMINI_HANDOFF.md and ../PRODUCTION_AUDIT.md for current behavior and checks.

## Conclusion

The fabricated demo interface has been replaced with a database-backed collaboration subset. This is not a production certification for the advertised voice/video product. Real Firebase project configuration, operational controls, remaining media services and native device measurements are release prerequisites. No deployment was performed.

## Review and remediation

| Before | After | Why |
| --- | --- | --- |
| Demo credentials, invented studio adoption and avatars | Removed from login and landing; canonical copy matches mobile | Public pages must not imply customers or identities that do not exist |
| Local JWT login immediately entered the app | Firebase email/password signup sends verification and signs out; unverified login rejects; backend accepts verified password-provider tokens | User requires verification-link completion before app access |
| No recovery or verification resend flow | Firebase password-reset email link and authenticated verification resend | Real provider actions replace unsupported UI claims |
| JWT stored in application localStorage | Firebase SDK owns session persistence and refreshed ID tokens; legacy JWT removed | Application does not retain an obsolete independent bearer token |
| Network session failure silently deleted login | Connection error with retry; session restore first reads `/auth/me`; actual unauthorized session signs out | A temporary outage must not erase a valid session |
| All workspace messages fetched into memory; older navigation eventually stopped at 500 records | One 50-message page, reversible Earlier/Newer/Latest navigation with no total-history cutoff | Bound transfer and retained history while keeping arbitrarily old conversations reachable |
| Rooms/members/workspaces silently stopped at fixed backend caps | Server search, truthful totals, Previous/Next/First controls and one visible 50-record page | Any authorized directory entry remains reachable without loading the whole directory |
| Selected room or saved workspace disappeared when outside the first directory page | Active room/workspace is validated by its own authenticated ID endpoint | Directory browsing cannot erase valid active context |
| Adding a member filtered only the locally loaded roster | Server candidate query excludes all actual room members before pagination | Members outside a loaded page cannot appear as new candidates |
| Background arrivals could replace historical reading or be marked read unseen | Archive feed applies changes only to retained IDs; unseen arrivals remain unread until latest/newer page is shown | Preserve the reading position and truthful unread state |
| Optimistic failed messages/reactions remained visible | Only server-confirmed messages/reactions appear; failed send retains draft with error | A failed dispatch must not look persisted |
| No refresh from other users | Serial five-second ordered change-feed polling; hidden documents skip network work | Changes to older loaded messages and independent pins are delivered without fetching all history |
| Fake call users, audio levels, waveform recorder and connected video | Removed; both call stages state calling unavailable; non-text composer is disabled | No RTC signaling, remote media or voice storage exists |
| Random microphone meter and invented hardware models | Browser `enumerateDevices()` only; saved device explicitly unavailable when absent | Hardware displayed is supplied by the actual browser |
| Fabricated diagnostics, E2EE and pinned guidance | Diagnostics/security claims removed; independent paginated pins come from the backend | Pins remain available when their messages are outside the latest history page |
| Edit/delete/pin commands unavailable | Server permissions and version-checked mutations, conflict recovery, real tombstones | Concurrent saves cannot silently overwrite a different saved version |
| Remote deletion discarded a pending edit | Draft stays visible in a selectable readonly editor, with an explicit deletion notice | An unsaved draft can still be copied without allowing changes to a deleted message |
| Private-room roster and profile controls unavailable | Actual room membership add/remove/leave and database profile name/status changes | Content and permissions come from the same backend contracts as mobile |
| Retained sender profiles outside the visible team page stayed stale | Tenant-scoped profile refresh for unique retained history/pin/action sender IDs, in batches of at most 100 | Refresh actual authors without downloading the directory or changing every historic message |
| Small reaction/action targets and unnamed reaction counts | Coarse-pointer targets at least 44 pixels and explicit add/remove reaction labels | Phone browser and screen-reader users can identify and activate real controls |
| Phone action controls narrowed the whole message column | Controls sit below the full-width message content at phone widths; sender metadata wraps | Keeps messages readable while retaining the touch targets |
| Silent settings save failures | Server-confirmed preferences, disabled controls during save, visible error | Failed preference changes remain reviewable |
| Empty workspace loaded forever | Explicit create-room form and retryable data failure | Empty state is a valid server result |
| Fixed desktop sidebar blocked small screens | Drawer-style sidebar and overlay inspector below breakpoints | Preserve usable chat at phone browser width |
| Unlabelled modal and hover-only message actions | Focus-trapped labelled dialogs, focus return, icon labels, visible reaction actions | Keyboard, screen-reader and touch access |
| Enter submitted while IME composing | Enter respects `nativeEvent.isComposing`; Shift+Enter remains newline | Compose non-Latin input safely |
| Placeholder team commands closed without action | Removed unsupported member navigation commands | Every exposed command has an actual destination or clear unavailable status |
| Broad `transition-all`, unconditional card hover motion | Explicit color/property transitions; pointer-gated button hover; reduced-motion support | Avoid unnecessary layout work and touch hover artifacts |
| Vulnerable source-map-js and Firebase pinned gRPC dependency | Lockfile updated; patched gRPC override; npm audit reports zero advisories | Current dependency audit identified exploitable transitive versions |

## Route and component inventory

| Route/component | Data source / behavior | Validation / limits |
| --- | --- | --- |
| `/` / LandingPage | Product copy; no user records or social proof | Desktop and phone-width browser navigation and overflow check |
| `/login` / LoginPage | Firebase signup/login, verification send/resend and reset-link provider actions | Actual Auth Emulator with real OOB codes; no production email delivery asserted |
| `/app` / App route guard | Verified Firebase identity and database user DTO | Unverified denial, verified entry, reload persistence, logout; SDK error/config states |
| Dashboard | Workspace/channel/member/settings APIs; active-channel pagination | Actual PostgreSQL-backed browser flow; async responses guarded after channel change |
| Workspace management dialogs | Real workspace list, `X-Workspace-Id`, owner/admin invite tokens, email-bound token join | Second verified user joined shared workspace and read its messages; switch restores isolation |
| Channel creation | POST channels with name/topic/type/privacy | Public and private text-room creation; creator membership and server permission flags |
| Sidebar | Real channel list, unread count, workspace members and current user | Desktop and phone navigation; presence is derived by backend activity, not RTC participants |
| MainStage / ChatView | Text/tombstone DTOs, real reactions, local ISO timestamp formatting | Send/reload/react, 55-message cursor history, server message permissions; voice/attachments unavailable |
| MessageActionsDialog | Version-checked edit/delete/pin requests and change-feed conflict notices | Draft preservation, explicit overwrite acknowledgment, moderation and disabled deleted-message actions |
| ContextDrawer | Real channel roster, independent paginated pins and member management | Actual member count; creator protected from removal/leave; workspace administrators need explicit private-room membership to read |
| ProfileModal | PATCH `/auth/profile`; name/status propagated to current-user and loaded sender displays | Name 1-80 characters, status at most 160; privileged fields rejected by the backend |
| SettingsModal | Database preferences and actual browser device enumeration | Persisted toggle reopen; device media processing remains unavailable |
| CommandPalette | Server-searched, paginated room navigation, preferences and clear unavailable call actions | Keyboard source review and focus management; no backend full-history message search |
| AudioHuddleStage | Explicit unavailable state | No participants, speaking simulation or fake codec/connectivity |
| VideoCallStage | Explicit unavailable state | No fake remote streams, screen sharing or leaked capture tracks |
| useDialog | Escape, tab trap and focus restoration | Dialog focus logic reviewed; broader assistive-technology audit still required |
| icons/Icons | Static SVG presentation | Icon-only interactive parents have explicit accessible labels |
| services/api | SDK token refresh, timeouts, encoded IDs, error/204 handling, workspace header | Real API integration; hosting must proxy `/api` or configure VITE_API_URL |
| services/firebase | Lazy real-project config and actual SDK lifecycle | Production emulator configuration rejected; public pages remain available if auth is unconfigured |
| main.tsx / index.html / CSS | React entry, typography and responsive application shell | Production build; native ProMotion/120 Hz is outside web browser proof |

## Verification evidence

Final scale continuation: the latest configured desktop project passed four tests with one expected no-config skip; the latest phone-web project also passed four tests with one expected skip. Both include the complete large-directory/history/pin/profile suite. Fresh isolated API processes preserved the production abuse limits between viewport suites.

- `npm run build`: TypeScript strict check and Vite production bundle pass; application bundle 492.73 kB / 131.23 kB gzip after Firebase/collaboration, bounded directory/history navigation and retained-author profile refresh.
- `npm audit`: zero advisories after source-map-js update and `@grpc/grpc-js` override.
- `npm run test:e2e` without Firebase config: four public/no-config tests passed on desktop Edge and phone-width Chromium/Edge, with six expected integration/scale skips when real services are absent.
- Final configured desktop project: four tests passed and one expected no-config test skipped (1.6 minutes), including the new real-service scale suite. The phone project is validated separately with a fresh isolated API lifecycle to respect the unchanged production authentication limiter; phone results are recorded after its final run. Earlier configured collaboration/Firebase suites had passed on both viewports. No runtime page errors or horizontal overflow occurred in the final desktop run.
- Actual Firebase Auth Emulator project `demo-fable-audit` and actual disposable PostgreSQL API were used for verification and password reset OOB-code completion. No mocked API responses or production seed content are used.
- Browser integration exercises verified identity provisioning, server-confirmed text/reactions, reload, room creation, newest-50/history55, owner invitation, second verified user joining, shared content, workspace switching, settings persistence, unavailable media feedback, inspector and reset-password login. See `tests/firebase.integration.spec.ts` for exact assertions.
- `tests/collaboration.integration.spec.ts` additionally exercises author edits, off-page pin/unpin/repin, preserved conflict drafts, profile persistence, private-room roster add/remove/leave, creator protection, denied non-author edits/deletes, owner moderation, tombstone propagation, strict private-room reads and remote deletion while an editor is open.
- `tests/scale.integration.spec.ts` persists guarded disposable fixtures in the actual audit database: 135 additional rooms, 235 additional users, 135 additional workspaces and 650 actual messages/pins. It verifies directory forward/back controls and search beyond old caps, independent active-room context, candidate exclusion after a real membership add, public roster paging, full reversible message/pin archives past 500 rows while retaining at most 50 per view, a real verified peer's unseen arrival remaining unread during archive reading, and saved-workspace validation after selecting the 135th added workspace. The same verified peer updates its actual profile outside the visible team page; retained sender metadata changes without incrementing the message version or creating history-wide synthetic events. Fixture imports are restricted to tests and reject production/non-local environments.
- Screenshots and retained failure traces are written into ignored `test-results/`; these are local test artifacts, not production content.

Firebase lifecycle follows the primary provider documentation: [manage users, verification and password reset](https://firebase.google.com/docs/auth/web/manage-users) and [authentication persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence).

## Content and behavior parity

Landing hero, feature descriptions, signup label and footer match mobile canonical copy. Both clients use the same workspace/channel/message/reaction/settings contracts, bounded reversible history and pin pages, server directory searches, version-checked message actions, private-room membership, database profile editing, unavailable media wording, verified email/password authentication, reset links, owner/admin manual invitations and token-bound workspace join. Native hardware device preferences use platform-specific presentation; they must not pretend to enumerate browser devices.

Web history and pins retain at most 50 DTOs each. Each directory retains 50 DTOs and at most 100 lightweight cursor strings; First results returns to the initial page, and server search reaches records beyond that cursor trail. A per-room map retains at most 2,500 message revision numbers, protects retained history/pins/open-action IDs and tracks eviction epochs. Incoming older versions cannot restore an unpinned or deleted message after its card leaves the view. Snapshots containing any obsolete known version or spanning revision eviction are retried as a whole, up to three attempts, or report a retryable failure. Initial pin/history checkpoints are reconciled to the earlier server change cursor. A refresh drains at most five pages of 100 changes, then yields until the next five-second refresh. Workspace metadata refreshes the current directory pages and selected room independently every 30 seconds, and an open roster every 15 seconds, only while visible. Author-profile refresh requests at most 101 unique IDs across history/pins/open action, in at most two 100-ID batches, and retains the returned profile slice plus the visible team page/current user. Profile projections do not write a synthetic change event for every historic message.

Phone-width browser checks validate responsive web behavior. They do not establish Android/iOS native correctness, stable 120 Hz performance, physical RAM usage or identical rendering on OLED/high-refresh panels. Native release measurements belong in `mobile/PERFORMANCE_AUDIT.md` and the project release report.

## Remaining release blockers

- Configure a real Firebase project consistently across web/mobile/Admin; enable email/password only, require minimum-12 password policy, email enumeration protection and authorized app domains/email templates. Supply backend project identity through workload identity/service credentials. Production verification/reset emails require a live Firebase project and actual mailbox checks.
- Calling needs a genuine signaling/SFU/TURN design, authenticated room membership, session persistence, reconnection and device capture/playback on both platforms. Voice and file features need authenticated object storage, limits, scanning/transcoding and download permissions. No fake fallback is retained.
- Direct messages, threads, server message search, push delivery, account deletion, workspace/member role administration, room ownership transfer and operational analytics remain unimplemented. They need database authorization and parity or an explicit narrower release scope. Basic message edit/delete/pin, private-room membership and name/status profile editing are now implemented.
- Polling is currently the delivery mechanism; production simultaneous-user scale needs connection-pool/load testing and a reliable real-time event architecture. Unread watermarks record the latest loaded real message, rather than marking a possibly unseen future server timestamp.
- Directory search currently covers room name/topic, user name/handle and workspace name; full-text message search is a separate unimplemented feature. Cursor navigation retains a bounded trail and exposes an explicit return to the first page. Channel change-log retention/compaction remains an operational database prerequisite.
- Deployment still requires TLS/reverse-proxy routing, validated CORS, monitoring/error reporting, PostgreSQL backup/restore exercises and environment/secret rotation. No production hosting configuration or service account was fabricated.
- Physical Android/iOS interaction, VoiceOver/TalkBack, full keyboard accessibility, offline/reconnection and native 120 Hz / 8.33 ms frame-budget / RAM profiling remain required. Build and browser smoke results must not be described as all-component native verification.
