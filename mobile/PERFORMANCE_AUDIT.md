# Fable mobile audit — 2026-10-13 to 2026-10-14 (Asia/Calcutta)

> Historical audit evidence. Current mobile now includes workspace/room administration, invitations/activity, full-history search, applied theme and authoritative unread refresh; disconnected media screens were removed. Automated test files/CI were removed by request. Current native exports/types/lint do not establish physical-device performance. Refer to ../ARCHITECTURE.md, ../GEMINI_HANDOFF.md and ../PRODUCTION_AUDIT.md.

## Readiness assessment

The client now displays persisted backend data and confirms message, reaction, channel, invitation, membership, profile and settings writes before presenting success. Message editing, deletion and pinning use server permissions and versions. Synthetic call participants, camera feeds, recording timers, waveform generation, demo credentials, fabricated customer counts and unsupported encryption/video quality claims were removed. The user's existing migration to `react-native-safe-area-context` was preserved.

Audio/video calling, recording, voice playback, attachment uploads/downloads, screen sharing and active media processing remain unavailable. The release clearly identifies these limitations. A working RTC/media service and native media integration are required before those features can be called production ready. Saving an audio preference does not activate an unavailable processor.

Type checks, lint and Android/iOS JavaScript bundle exports were verified. Physical-device interaction, native installation, memory profiling, sustained frame-rate measurements and accessibility-device testing have **not** been performed. A successful bundle export does not establish native device performance or store readiness.

## UI and performance changes

Review followed the repository's `emil-design-eng` skill.

| Before | After | Why |
| --- | --- | --- |
| All-channel message history and mock state retained together | Only the selected channel; 50 messages initially, reversible 50-row archive pages, a maximum of 100 live rows per stream | Bounds client message storage and transfer; removes invented workspace state |
| Chat row definitions recreated while typing | Memoized message rows, stable list callbacks and identifiers | Keeps composing from rerendering every visible message |
| Content-size changes always animated to the end | Inverted list, position preservation, follow newest only near the bottom | Reading earlier messages is not interrupted by loading or reactions |
| Whole team and channel trees mounted through `ScrollView` | `SectionList` for navigation/search and `FlatList` for members/messages | Bounds mounted native views as the workspace grows |
| Every channel fetched together | Selected-channel polling every 15 seconds, one request at a time | Avoids overlapping network work and keeps transfer bounded |
| Requests and refresh continued without lifecycle handling | Polling pauses in the background; in-flight history requests abort on background/channel changes; subscriptions/timers clean up | Reduces unnecessary radio, CPU and memory work |
| Delayed reads could overwrite successful mutations | Message revision checks, ordered checkpoints and channel checks suppress stale request results | Keeps the displayed message state consistent with confirmed changes |
| Edits/deletes had no persisted actions | Accessible message action sheet uses server-provided permissions and optimistic concurrency versions; delete requires confirmation | Prevents unauthorized controls and silent overwrites |
| Polling latest history omitted edits to older retained rows | Ordered, durable change-feed checkpoint; up to five 100-change batches per refresh | Updates retained older messages and tombstones without downloading all history |
| Parallel conversation/pin reads could choose a checkpoint after an unseen unpin | Replay from the earlier of both server checkpoints using exact BigInt comparison | Prevents gaps between independent initial snapshots, including very large sequence IDs |
| Unpin/delete could lose the version needed to reject a delayed pin response | Separate highest-seen version registry, capped at 2,000 IDs per selected channel; current retained IDs are protected during eviction | Rejects stale acknowledgements and prevents resurrecting removed pins |
| New page objects rerendered unchanged rows | Same-version rows and unchanged team profiles preserve object identity | Keeps memoized message rows useful during synchronization |
| Every update could sort the retained window again | Ordinary edits/deletes preserve ordering; only new rows or changed timestamps require sorting | Reduces avoidable JS work during foreground synchronization |
| Pins outside loaded chat history were inaccessible | Independent paginated pinned-message view; conversation and pins each retain one 50-row archive page or at most 100 live rows | Shows real pins without fetching unbounded chat history |
| Concurrent edits could silently adopt a new base revision | Edit/delete confirmation captures its starting revision; explicit “Use latest version” preserves the draft after a conflict | Requires a deliberate decision before overwriting a changed message |
| Remote deletion or a large arrival burst could dismiss an open editor and lose its draft | One separate editor DTO stays synchronized after its row is evicted; draft remains copyable with a clear deletion notice and disabled save | Preserves unsaved work while respecting the deleted backend record |
| Read receipts were written on every poll | Read receipt is sent only when the newest loaded message ID changes | Reduces redundant requests and database writes |
| Larger workspaces hid records beyond fixed directory limits | Server-side search and 50-row cursor pages for rooms/workspaces/team/roster/candidates, with 100 cursor IDs and explicit First results | Reaches every authorized matching record while bounding memory |
| History became inaccessible beyond the retained 500-message cap | Earlier/Newer/Latest navigation replaces a bounded archive page and keeps selected room context independent of directory results | Allows arbitrary history access without accumulating message bodies |
| New arrivals could displace an archived page or advance its read watermark | Archived feed updates only displayed IDs; live arrivals stay unread until latest conversation is displayed | Preserves the chosen historical context and read correctness |
| A known higher revision could cause an evicted snapshot row to be silently discarded | Retry the bounded page twice, then preserve the current page with an observable error if it keeps changing | Preserves tombstones and pagination identities during races |
| Room information showed a workspace roster | Actual room-members endpoint, authoritative membership-management flags and confirmations | Correctly scopes private-room membership and removal rights |
| Self-leave retained cached private-room contents during refresh | Confirmed leave immediately clears the selected private room and its caches | Prevents continued display after access is relinquished |
| Sender names outside the first directory page could remain stale | Scoped profile lookup for only retained message/pin/editor authors, with deduplicated 100-ID batches and stable object reuse | Keeps large-workspace identities current without downloading the whole team or rewriting old messages |
| Profile edits were absent and old sender names could remain cached | Saved name/status edits update session/team immediately; stable profile map and foreground metadata refresh update retained sender displays | Keeps identity consistent across current and older messages |
| Read receipts could clear messages that arrived after the page request | Confirmed read watermark is the newest message actually loaded | Prevents a read update from marking later unseen server writes as read |
| Synthetic recording timer and 150 ms spectrum timer rerendered the call screen | Simulators removed; media state truthfully unavailable | Removes recurring JS/render work and false media behavior |
| Unused Expo starter components, exploration links and long rotating icon animation | Removed unused scaffold and invalid route references | Reduces maintenance surface and removes an unrelated visual experience |
| Button press stored local React state; web transition animated `all` | `Pressable` state styling, a specific 100 ms transform transition and 44-point minimum button height | Reduces state churn, gives prompt feedback, and avoids unintended transitions |
| Movement ignored reduced-motion preference | Buttons, modal transitions and chat scroll animation respect reduced motion | Supports users who cannot tolerate unnecessary movement |
| Android modal dismissal missing | Every modal implements `onRequestClose`; native predictive-back enabled | Gives hardware-back navigation consistent behavior |
| Nested safe-area padding | Dashboard owns top inset; chat owns bottom/side insets | Prevents duplicate padding while protecting the composer and notices |
| Icon controls unlabeled and small | Accessible action labels, selected/disabled/busy state, increased touch regions | Makes the actual action clear to assistive technology |
| Failed message sends cleared the draft and displayed an optimistic message | The draft stays until the server saves the message; failures appear visibly | Allows recovery without pretending a write succeeded |
| Failed settings saves closed the modal | Save awaited, controls locked while saving, visible errors, close after success | Prevents lost preferences and misleading confirmation |
| React Native Web `Alert.alert` silently did nothing | Calls, voice-note limitations and reaction errors are rendered as visible application notices | Makes unavailable actions and failures observable in the mobile browser too |
| ISO timestamps rendered raw | A reused local date/time formatter | Shows backend timestamps in the reader's locale without inventing times |
| Channel information labeled the whole team as channel members | Workspace member list and separate server-provided channel member count | Describes exactly the data supplied by the API |

## Component and data coverage

| Surface | Data/behavior | Verification level |
| --- | --- | --- |
| Landing | Static product description; supported text features and explicit media limitations; no fake social proof | Source review, type/lint checks, bundle export |
| Authentication | Firebase email/password, verification/resend/reset, session restore integrated by the parent agent | Parent integration and live emulator checks; not a physical-device credential test |
| Dashboard | Real channels, members and settings; loading/retry/empty states; selected-channel polling and server-confirmed writes | Source review, type/lint checks, bundle export |
| Chat | Reversible real message/pin archive pages, versioned edit/delete/pin actions, tombstones, retained failed drafts, bounded change synchronization | Source review, type/lint checks, state regression tests; continuation browser/device validation recorded separately |
| Workspace manager | Workspace switching, channel creation (name/topic/type/privacy), administrator invitations with actual tokens, native share sheet, joining by token | Source review, type/lint checks, bundle export; native share-sheet interaction requires a device |
| Sidebar | Real channels, privacy, unread counts and members; virtualization; search, management, preferences and logout actions | Source review, type/lint checks, bundle export |
| Search | Server search over all authorized channels and workspace members; bounded independent pages; explicit unavailable media actions; virtualized results and empty state | Source review, type/lint checks, bundle export |
| Channel context | Paged room roster and actual database-excluded candidate search, privacy, counts, add/remove permissions and confirmed self-leave | Source review, type/lint checks; continuation browser/device validation recorded separately |
| Profile | Persisted display name and status, clear status, immediate session/team updates, observable save failure | Source review, type/lint checks; continuation browser/device validation recorded separately |
| Settings | Database-backed volume/noise/spatial preferences, saved device selections and reset to system defaults; awaited updates; no false processor/quality claims | Source review, type/lint checks, bundle export |
| Audio/video surfaces | Explicit unavailable state; no timers, simulated feeds or invented participants | Source review, type/lint checks, bundle export |
| Shared button/input/avatar/card/tag | Press/focus behavior, accessibility and actual user identity metadata; input focus callbacks preserved | Source review, type/lint checks, bundle export |

Web and mobile now use the same server resources and operation semantics for the implemented workspace features. Platform-specific layouts and native sharing/device controls differ. Exact visual/content parity across every interaction still requires paired runtime walkthroughs; the parent audit records the browser checks separately.

## 120 Hz readiness

`ios.infoPlist.CADisableMinimumFrameDurationOnPhone = true` opts compatible iPhones into frame rates above the system default. This is a capability setting, not a promise of a measured 120 fps result. Apple determines the actual refresh rate based on device support and system conditions. [Apple's setting documentation](https://developer.apple.com/documentation/bundleresources/information-property-list/cadisableminimumframedurationonphone).

At 120 Hz, one frame has approximately 8.33 ms. Native list scrolling and modal transitions avoid a per-frame JS animation loop; the former fake spectrum repeatedly changed layout on the JS thread and has been removed. Native/device refresh behavior must still be tested on 120 Hz iPhone and Android hardware. Android has no artificial 60 Hz application timer here, but device display modes, OS governors and thermal/power conditions control its refresh behavior. [React Native performance guidance](https://reactnative.dev/docs/performance), [list configuration guidance](https://reactnative.dev/docs/optimizing-flatlist-configuration).

Release profiling must cover: cold/warm launch; typing while requests resolve; scrolling loaded history; switching channels repeatedly; opening/closing each modal; entering/backgrounding/resuming; offline failure and retry; large text/font sizes; VoiceOver/TalkBack; a 20-minute session with multiple workspace switches. Use Instruments/Core Animation and allocations on iOS; Perfetto/System Trace and memory tools on Android. Record device, OS, refresh mode, build type, retained heap, peak memory, request volume and dropped-frame counts. Compare the heap after returning to the same idle screen to detect retained resources. Run both normal power and low-power/thermal scenarios.

## Checks run

- `npx tsc --noEmit`: passed for the complete mobile source.
- `npx eslint src --no-cache`: passed without warnings. An earlier cached `expo lint` output retained a warning for an already replaced file; the uncached full-source check is authoritative.
- `npx expo config --type public`: resolved Fable branding, predictive back, secure-store plugin and the ProMotion Info.plist key.
- Prior continuation before the directory/history changes: `npx expo export --platform android --platform ios --max-workers 2 --output-dir .audit-export-final` passed for both platforms with React Compiler enabled and the completed message/roster/profile, remote-deletion draft and reaction-display fixes. The export produced approximately 3.9 MB iOS and 4.1 MB Android Hermes bundles, in approximately 17 and 10 seconds respectively; these are build observations with warm caches, not runtime RAM/FPS measurements.
- Directory/history continuation before the bounded sender-profile service addition: Android/iOS exports passed again after pagination, archive navigation and the independently synchronized open-editor DTO fix. Warm build observations were approximately 12.6 seconds Android (1,603 modules, 4.1 MB Hermes) and 23.8 seconds iOS (1,509 modules, 3.9 MB Hermes). Native installation, frame time and memory measurements remain unperformed.
- Generated export artifacts remain local and are ignored by Git.
- Parent-agent Expo-browser smoke checks confirmed signup, the email-verification gate, login, a database-backed message/reaction and reload without application errors. These browser results do not replace native-device verification; the parent audit records the expanded walkthrough.
- Directory/history continuation: `npm run test` passed all 22 mobile tests, including sixteen regression cases covering snapshot checkpoint ordering, out-of-order acknowledgements, unchanged row identity, older loaded tombstones, off-window pins, stale pin resurrection after unpin/delete, concurrent initial snapshots, memory caps and profile refresh, archive updates without new-arrival insertion, reversible traversal of 650 messages, protected retained revisions, and stale evicted-body snapshot detection and synchronization of an open editor after its chat row leaves the live window, and bounded sender-profile batches beyond the first team-directory page.
- Change synchronization and history requests abort on background/unmount/channel change. One refresh runs at a time. Live channel/current-profile metadata refreshes every 60 seconds in the foreground; retained sender IDs use the scoped profile lookup in batches of at most 100 (at most three calls for 201 senders), alongside one 50-member directory page. The combined stable profile map is capped by those retained IDs plus 50 directory records and one current identity (at most 252 DTOs). Message changes refresh every 15 seconds.
- Retained client budgets are a 50-row archived page or at most 100 live rows per conversation/pin stream, 50 DTOs per directory, 100 lightweight previous cursor IDs per directory, one separate open-editor DTO, and 2,000 revision IDs for the selected channel. The revision registry holds IDs/numbers rather than additional message bodies and clears on channel/workspace selection.
- Parent-agent expanded Expo-browser smoke checks passed signup, verification gating, login, persisted messages/reactions/edit/delete/pins, reload, profile changes, saved preferences, channel creation, invitation/join with a second verified account, private roster add/remove/leave and protected creator, administrator deletion during the author's open edit (draft kept, save disabled), logout and password reset/new-password login. Composer entry after dismissing a native-style modal uses an actual tap/focus before filling; this avoids a synthetic browser-fill/focus race without adding timing sleeps.

- Parent-agent large-workspace Expo browser walkthrough passed server search/paging beyond former caps with 135 rooms, 235 team members and 135 workspaces; it traversed 650 conversation messages and 650 pins using bounded Earlier/Newer/Latest pages. Selecting a workspace outside the first page survived reload via GET-by-ID validation. A peer arrival during archived history stayed outside that page and remained unread. This walkthrough preceded the final one-editor-DTO safety refinement; its final full smoke rerun is tracked in the parent audit.

## Dependency findings

Final continuation: all 22 mobile regression tests, complete typechecking and uncached source lint passed. The complete actual-service browser walkthrough also passed the one-editor-DTO and scoped author-profile service changes: a verified peer outside the first 50 member results updated its name through the real API, and the visible message refreshed without a synthetic message revision. The final basic walkthrough additionally verified the native heart-reaction control against persisted counts. Directory/history test records remain confined to the explicitly enabled disposable audit database.

The parent agent remediated compatible UUID and URI-decoder advisories, preserved the Expo CJS interfaces, verified clean installation and tested the compatibility paths. The current mobile dependency scan reports 18 high findings, zero moderate and zero critical findings, down from 29 earlier entries. Remaining inherited findings are rooted in `braces` and `node-forge` advisories with no available patched upstream release in the parent's review. These are recorded release findings, rather than a claim that the dependency graph is vulnerability-free. The parent production audit documents exposure and remediation details.

## Remaining release work

Latest final exports after the bounded profile lookup and heart-reaction parity change passed: approximately 3.9 MB iOS and 4.1 MB Android Hermes bundles, with warm build times around 19 and 27 seconds. These remain bundling evidence rather than native installation or measured performance.

Configure the real Firebase project, authorized verification/reset URLs, HTTPS API host and deployed database. Complete physical-device/native-install checks and the profile above. Native application identifiers, signing and store privacy declarations need deployment-specific configuration; the parent agent prepared Fable brand artwork. Deliver and test the RTC/media service before enabling media actions. Arbitrary history and directory browsing are implemented with bounded pages. The large-workspace Expo browser walkthrough and final Android/iOS exports passed; these remain browser/bundling evidence, not physical-device certification. Creator removal/self-leave remains deliberately blocked until ownership transfer exists. No FPS, RAM, battery-life or all-device correctness guarantee is asserted by this audit.
