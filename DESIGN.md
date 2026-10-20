# Fable interface design

Updated: 20 October 2026.

## Mobile right navigation drawer

The latest navigation request applies to mobile only; leave the web client unchanged. Phones keep the conversation list as the main page and open conversations from it. A hamburger at the right of the list and conversation headers opens navigation from the right. The drawer uses approximately 74% of the viewport, normally 240–288 logical points, with at least 72 points of the chat visible. Widths of 320/360/393/430 points produce drawers of 240/266/288/288 points. Tablets also cap the drawer at 288. A left swipe starting within 28 points of the right edge also opens it. Vertical scrolling and gestures away from that edge retain their normal behavior.

The user's ChatGPT/Gemini reference informs the coordinated push-aside behavior: the chat translates left by exactly the revealed drawer width. Its trailing corners round slightly, without scaling the text. Both surfaces use the same Reanimated shared value, including during drag dismissal, with a 300 ms ease-out entrance and a faster, distance-adjusted close of up to 220 ms. The dimming is reduced to 12% so the visible chat provides context. A drag captures the current animation position before following the finger, avoiding jumps if opening is interrupted. The modal begins the animation on `onShow`, and renders outside the translated content.

Sizing is a Fable design choice, not a measured retention optimum or a claim to reproduce either reference app's exact dimensions. The [Material Android drawer reference](https://github.com/material-components/material-components-android/blob/master/docs/components/NavigationDrawer.md) lists a compact 280 dp maximum as a useful comparison. Retention impact needs actual product measurement.

The drawer contains the real profile, Messages, People, New chat, directory search, group management, Settings and logout actions. An open conversation adds message search and Chat details. Those two actions move into the drawer to keep the phone header compact; audio/video calling remains in the conversation header. The old inline account menu and list footer are removed. Navigation actions run after dismissal and retain the current conversation/draft unless another chat is selected.

Reanimated handles the panel and dimming, including a swipe right to dismiss; a short swipe returns it to the open position. Backdrop, close button, Android Back and accessibility escape also dismiss it. The panel respects safe areas, appearance, large text and reduced motion. The drawer pauses conversation read advancement while covering the chat. No dependencies, API contracts or database records change.

Manual native acceptance: open/dismiss from both list and conversation; confirm the chat and panel stay aligned throughout opening, closing and dragging; grab the panel before the entrance finishes; try short/cancelled swipes, repeated taps and Android Back; confirm vertical list/drawer scrolling; exercise every action and draft preservation; rotate, open the keyboard, use large text, TalkBack/VoiceOver and reduced motion in both themes. Check the right-edge gesture with Android system gesture navigation enabled on a physical device. Review narrow phones and tablets for the visible chat strip, clipped content and reachable labels.

## iMessage-style expansion — latest direction

The latest request supersedes the earlier Instrument Serif conversation treatment below: signed-in messaging now uses system typography on web and native. Instrument Serif stays on branding and the public landing. Preserve blue outgoing/neutral incoming bubbles, compact two-column navigation, full-width phone views and real backend content. New controls include direct recipients, inline replies, emoji, attachment drafts, audio recording and calling from a direct conversation. Reduced motion disables message entrances and typing bounce. One media preview is retained per conversation. Calling is a real modal media session with answer/decline, mute, camera and end controls; it must never be replaced with a simulated connected state. See `FEATURE_PARITY.md` for the incomplete parity items.

The signed-in experience follows the user's everyday messenger direction: one conversation list and one wide conversation, quiet neutral surfaces and blue outgoing bubbles. The latest request extends the landing footer's Instrument Serif into all Fable wordmarks and conversation typography on web and native. No navigation rail, hashtag decoration or developer-oriented terminology belongs in the main experience. The public landing page has a separate editorial identity, described below.

## Shared brand and conversation typography

Instrument Serif Regular is now the shared wordmark face on the landing page, login screens and loading states, with the native footer using the same brand component. Web defines the face and `--font-editorial` globally and preloads the single local font in `index.html`, so direct visits to `/app` and `/login` do not depend on loading the landing page first. The landing's existing oversized footer lettering retains the same font, weight and treatment.

Chat list headings, conversation names, message authors, message text and the composer use this face in both clients. Main message/composer text is 18px with approximately 25px line height; chat names use 18px in the list and 22px in the conversation header. Message search results, pinned message content and edit fields use the same conversation treatment. Navigation controls, metadata, timestamps and supporting copy retain system sans-serif; code retains monospace. Regular weight avoids manufacturing a bold version of the single supplied font. The compact columns, spacing and light/dark colors remain in place.

Native bundles an identical font with its SIL OFL license/source notice under `mobile/assets/fonts/instrument-serif`. The already-installed Expo Font module loads it at the root before routes appear, and font errors release the splash screen rather than leaving it indefinitely visible. This follows the [Expo Font loading guidance](https://docs.expo.dev/versions/latest/sdk/font/); no package or SDK change is required.

Manual review should cover cold starts directly into `/app` and `/login`, wordmarks at all responsive widths, multiline input/editing, long names, mixed scripts and emoji, code snippets, text scaling and both appearance modes. Native font loading and baseline/keyboard rendering still require a device walkthrough.

## Public landing page

The latest request rebuilds the public page around the promise of a home for good conversations. `/welcome` is always available, including while session restoration is loading or fails; anonymous `/` also shows this page. Signed-in `/` continues to open the messenger. Landing code and CSS load separately from the messenger.

The palette combines warm paper `#F7F8F2`, forest ink `#1C3028`, cobalt `#2452DE` and a restrained lime accent `#DCF498`. Whole Instrument Serif headlines contrast with system sans-serif navigation and body copy. The unmodified font's SIL Open Font License and pinned Google Fonts source are included under `frontend/public/fonts/instrument-serif`; it is now shared with branding and conversation typography. The original SVG conversation sculpture, oversized wordmark, editorial sections and blue closing invitation provide the page's identity without changing the compact app layout.

The feature tour covers actual conversations, search and pins. Its tabs support arrows, Home and End, with valid tab/panel relationships and a shareable `?tour=` URL. Illustrations are labeled as product illustrations and contain no fictional contacts, message history, activity counts or social proof. FAQ disclosure controls and navigation links work; signup, login and Open Fable lead to the real existing routes. Development entry retains its existing behavior.

Layout adapts at 1100px, 800px and 480px, with safe-area gutters, readable body text, visible keyboard focus and reduced-motion support. Motion is limited to a short entrance and user-triggered tour changes. No autoplay, scroll hijacking or new animation dependency is used.

Research used the [frontend-design guidance](https://skills.sh/anthropics/skills/frontend-design), its [source instructions](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md), and [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md). These informed typography, identity, semantics and motion; no award or measured conversion outcome is claimed.

Manual landing review remains required at 320px, 375px, 768px and 1440px. Check horizontal overflow, zoom, reduced motion, keyboard tab selection, deep links, back navigation, FAQ disclosure and signup/login/Open Fable destinations. Open `/welcome` while the API is unavailable and confirm public content remains accessible. Browser automation was blocked by the environment, so build and source checks do not establish rendered visual or interaction results.

## Layout

Desktop web (above 760px) and native tablet (840px and wider) use exactly two persistent columns:

    +--------------------------+-------------------------------------------+
    | Messages       More  New | Chat name                     Search Info |
    | Search chats             | Description / people                      |
    |                          |                                           |
    | Conversation             | Received gray bubble                      |
    | Conversation             |                      Blue outgoing bubble |
    | Conversation             |                                           |
    |                          | Received gray bubble                      |
    | Current group / options  | Message                              Send |
    +--------------------------+-------------------------------------------+

The web app fills the browser edge to edge at every width, without an outer margin, rounded window frame, shadow or maximum width. Its list is 248-292px; the native tablet list is 320px. The conversation uses the remaining width. Chat details overlays the conversation when requested; it never adds a persistent third column. Phones switch between a full-width list and a full-width conversation with a visible Chats back control. Native Android hardware back returns to the list. Opening the list retains the mounted conversation draft. Hidden phone conversations do not advance read markers.

Web density uses 60px headers, 64px minimum conversation rows, 36px list avatars and 16-32px conversation gutters (12px on phones). Message padding and group spacing are tighter, and previews use one line. Phones retain 44px message options, readable 16px form inputs and safe-area padding. One message-options control opens real reactions/edit/pin/delete actions, keeping the message list compact.

The browser shell and dialogs follow the visual viewport when the keyboard or browser chrome resizes it. The viewport adapter releases its adjustments during pinch zoom and falls back to dynamic viewport units when the browser API is unavailable. This follows the [VisualViewport API](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport); physical keyboard/browser behavior remains subject to manual review.

Account/profile, people, group management, settings and logout are secondary menu actions. The actual group name and picker remain available in the web list footer. Native Groups opens the existing group manager. New chat opens a focused form on both platforms, backed by the existing authorized creation endpoint.

## Colors and typography

| Role            | Light              | Dark                  |
| --------------- | ------------------ | --------------------- |
| Conversation    | #FFFFFF            | #18181A               |
| Sidebar         | #F3F3F5            | #232326               |
| Main text       | #1D1D1F            | #F5F5F7               |
| Secondary text  | #535358            | #D0D0D5               |
| Metadata        | #6C6C72            | #AAAAB2               |
| Primary control | #0067DD with white | #80B9FF with dark ink |
| Outgoing bubble | #0067DD with white | Same                  |
| Received bubble | #E9E9EB            | #303034               |
| Selection       | #E3EDFC            | #253F5E               |
| Selection hover | #D4E4FA            | #314F71               |
| Input boundary  | #89898F            | #777780               |

Brand and conversation text use the shared Instrument Serif face described above. Supporting web interface text uses the local Apple/system stack, falling back to Segoe UI and common sans-serif faces. Native supporting text uses built-in platform faces (Helvetica Neue on iOS, sans-serif variants on Android). Code retains a platform monospace face. Rounded bubbles, fine separators and restrained elevation establish hierarchy; the rejected cyan/lavender gradients and purple treatment are removed.

The web theme host must set `color: var(--ink)` as well as defining theme variables: text inherited from a light-mode ancestor does not recalculate when only a descendant's variables change. Keep selection hover colors paired with selection text. Native text must name a palette color explicitly, including error, conflict and notice text; native views do not supply CSS-style text inheritance.

## Language and real data

- UI labels use chats, people and groups. Existing API/type/database identifiers remain channels and workspaces; permissions and schema are unchanged.
- Conversation previews display actual topics or membership counts. No fictional latest-message text, delivery status, online presence, contacts or timestamps are introduced.
- These are the existing authorized group chats. Direct messages, replies and attachments have not been added or implied by fake controls.
- New chat explains who can see a public/private chat; private participants are managed in Chat details after server-confirmed creation.
- Sending, edits, deletion, reactions, pins, message search and independent history pagination retain their real server behavior. Failed sends preserve the draft. Theme changes persist through the existing settings API.
- Native lists remain virtualized and bounded; directory refreshes only run in the foreground. Touch actions, keyboard focus, reduced motion and light/dark tokens are retained.

## Assets, references and verification

Fable's authored vector mark and deterministic native PNG exports now use the same blue accent. Run scripts/export-brand-assets.ps1 to reproduce native raster assets on Windows. The unused Jakarta font files were removed.

The visual reference is [Apple Messages for Mac](https://support.apple.com/guide/messages/icht66ecaafe/mac), with [Apple's sidebar guidance](https://developer.apple.com/design/human-interface-guidelines/sidebars) informing the list/detail arrangement. Earlier skill research is background context; the user's latest two-column request governs the design.

Production builds, strict type checks, lint, native JavaScript exports and documented live read checks are the verification approach. No tests or CI were added. The environment blocked browser automation; rendered browser, accessibility and physical-device walkthroughs remain manual. See PRODUCTION_AUDIT.md for executed checks and limitations.

Manual review should cover the following journeys:

- At desktop/tablet widths, confirm the list and conversation occupy two columns and Chat details overlays the conversation. Check 320px, 375px, 768px, 1440px and ultrawide browser widths for outer margins or horizontal overflow.
- On mobile web, open the keyboard in the composer and in a dialog, expand a multiline draft, rotate the device and try pinch zoom. Confirm the focused field and send/save controls remain reachable and the layout recovers when the keyboard closes.
- On a phone, open a chat, enter a draft, return to Chats and reopen it. Confirm the draft remains. With a second authorized account, confirm messages received while the list is open remain unread until the conversation is opened.
- Open account options using the keyboard, open Settings or Profile, close it and confirm focus returns to the options control. Check narrow widths, long names, text scaling and both appearance modes.
- Create a public/private chat, confirm the real server result, and use Chat details to manage private participants. Verify failed requests preserve input and do not report success.
- On native, use Android back to return to Chats, open message actions to add/remove a reaction, and verify the persisted result on the other client.
