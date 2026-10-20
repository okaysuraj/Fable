# Fable messenger feature coverage

Updated: 20 October 2026. The requested direction is an iMessage-style Fable messenger across the existing React web and Expo clients. This is a coverage record, not a claim of complete iMessage parity. **Implemented** means connected source code; it does not imply physical-device or two-person acceptance.

| Capability | Web | Native | Remaining acceptance or work |
| --- | --- | --- | --- |
| System typography, blue/gray bubbles, light/dark, responsive columns | Implemented | Implemented | Visual review on physical devices and assistive technology |
| Message entrance motion and reduced motion | Implemented | Implemented with Reanimated | Device frame timing and gesture polish |
| Right-side hamburger navigation and edge swipe | Unchanged at user request | Compact adaptive drawer; synchronized chat push-aside and drag dismissal | Physical-device motion/gestures, Android system navigation, accessibility and rotation walkthrough; retention impact unmeasured |
| Direct conversations | Implemented | Implemented | Two actual participants, concurrent creation and workspace removal walkthrough |
| Existing private/public groups, membership and invitations | Existing implementation | Existing implementation | Still uses workspace-scoped discovery; no phone contact graph |
| Recent conversation order and real previews | Implemented | Implemented | Changing-feed page refresh behavior |
| Text, code, earlier/newer history and search | Existing implementation | Existing implementation | Full-text search does not index media bytes |
| Emoji input and large emoji messages | Implemented | Implemented | Picker has common presets; system keyboards can enter other Unicode emoji |
| Tapback-style reactions | Expanded presets | Expanded presets | Arbitrary emoji reaction picker and one-reaction-per-person semantics remain pending |
| Quoted replies | Implemented within retained history | Implemented within retained history | Full thread view, reply counts and navigation to an off-window parent |
| Edit and delete messages | Existing versioned mutations | Existing versioned mutations | Apple-style timed undo-send, edit history and Recently Deleted are pending |
| Message pins | Existing implementation | Existing implementation | Conversation pinning and drag reordering are separate pending features |
| Typing indicators | Expiring server leases | Expiring server leases | Polling rather than a push connection |
| Sent and read status | Server-backed | Server-backed | Delivery acknowledgements and read-receipt privacy controls |
| Photos, video and file attachments | Protected upload, preview, save | OS file picker, preview, playback, sharing | 10 MiB/file, four/message, 100 MiB/account; camera capture and galleries pending |
| Voice messages | Actual PCM WAV recording/playback | Actual M4A recording/playback | Two-minute limit; physical permission, audio focus, interruption and cross-device codec checks |
| Audio and video calls | Actual WebRTC implementation | Actual native WebRTC implementation | Two-person media acceptance pending; native binary required; Expo Doctor architecture warning remains |
| Call answer, decline, mute, camera off and hangup | Implemented | Implemented | Camera flip, device selection, ringtone, duration/history UI, screen sharing and robust ICE restart pending |
| Group calls and screen sharing | Pending | Pending | Multiparty signaling/media design and OS integration |
| Background calls and incoming notifications | Pending | Pending | Native call integration, APNs/FCM credentials, device registration and durable push delivery |
| Chat backgrounds | Pending | Pending | Persisted shared background selection and rendering |
| Polls | Pending | Pending | Authorized options/votes, concurrency and client presentation |
| Stickers, GIF discovery, drawings and custom avatars | Pending | Pending | Real storage/rendering and an approved GIF source where needed |
| Bubble/screen effects and invisible ink | Pending | Pending | Persisted effects, accessible reveal and reduced-motion behavior |
| Scheduled send | Pending | Pending | Durable scheduling, cancellation, worker recovery and user time zones |
| Location and Check In | Pending | Pending | Consent, permission handling, expiring location scope and background processing |
| Link previews and rich text formatting | Pending | Pending | Safe rendering, scoped fetching and SSRF controls |
| Contact sharing, blocked contacts and spam filtering | Pending | Pending | A contact model and authorization/privacy rules |
| Offline queue, synced drafts and multi-device delivery | Pending | Pending | Local drafts survive failed sends; no durable offline queue is claimed |
| End-to-end encrypted messages and key verification | Pending | Pending | Key lifecycle, multi-device cryptography, recovery and review; server currently stores message/media content |
| Translation, transcription and generated emoji | Pending | Pending | Approved real models/services and privacy/data-flow decisions |
| SMS/RCS, Apple's iMessage network, FaceTime, Apple Cash, Memoji and iCloud sync | No integration | No integration | These Apple/carrier services are separate from Fable's own implementation |

Apple's references include [Messages](https://support.apple.com/guide/iphone/about-imessage-iph4e9799206/ios), [conversation backgrounds](https://support.apple.com/guide/iphone/add-backgrounds-iph605fa06e4/ios) and [polls](https://support.apple.com/guide/iphone/poll-people-in-a-conversation-iphde1787df4/ios). Calling uses the [React Native WebRTC API](https://github.com/react-native-webrtc/react-native-webrtc/blob/master/Documentation/BasicUsage.md) and the [Expo native config plugin](https://github.com/expo/config-plugins/tree/main/packages/react-native-webrtc), rather than FaceTime.

## Manual acceptance walkthrough

1. Start the existing Docker database, then `npm run dev:api`, `npm run dev:web` and the native app. Keep the existing development identity enabled for local use. A browser opened through a LAN IP needs HTTPS for microphone/camera capture; browser localhost is a secure context. A physical native device needs a reachable API URL.
2. Use two actual participants in the same workspace. All clients on one development API share its single configured identity. For Firebase-free two-person verification, use separate API processes with deliberate development identity names/emails and ports, then accept an invitation into the same workspace. Do not create fictional people in runtime data to make the interface look populated.
3. Open **New chat**, find the other participant and open the direct conversation. Open it concurrently from both sides and confirm the same conversation appears. Verify an unrelated workspace member cannot fetch it, alter its participants or obtain its media/call signaling.
4. Send text and emoji in both directions, reply to retained text, react, edit and delete. Check the other device's updates and the real list preview. Browse archives without clearing future unread messages. Check typing expires after stopping, backgrounding or losing connectivity. Confirm **Read** appears only after the other participant views the conversation.
5. Attach a photo, short video and file; preview the draft, send and open each from the other platform. Verify one open media preview replaces the previous one. Record, stop and send voice in both directions. Deny microphone permission, exceed a file limit, disconnect during upload/send and retry without losing the draft or fabricating success. Delete a media message and confirm the asset URL no longer authorizes a download.
6. Install a new Expo development/release binary with the new modules. A JS export is insufficient. Start an audio call and a video call in each direction; answer, decline, mute, disable camera, hang up and deny permissions. Verify actual audio/video reaches the other device. Leave the app, switch workspaces, kill a process and lose network access; camera/microphone must stop and call leases must expire. Native background calling is intentionally unavailable in this implementation.
7. Repeat across different networks after configuring operator-owned TURN in `WEBRTC_ICE_SERVERS`. Verify relayed media, blocked UDP and failure/retry states. Public-server or physical native acceptance has not been performed here.
8. Review keyboard operation, screen-reader names, large text, reduced motion, zoom and small phone layout. Check release-device battery/memory behavior and media cleanup. No 120 Hz or production-readiness claim follows from local compilation.

Native build commands and signing depend on the existing owned identifiers/EAS profiles. This Windows environment has no detected Android/iOS toolchain or attached device. Do not suppress Expo Doctor's WebRTC architecture warning to make a report appear clean.
