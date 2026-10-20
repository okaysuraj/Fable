import type { ConfigContext, ExpoConfig } from "expo/config";

const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
if (
  googleIosClientId &&
  !/^[\w-]+\.apps\.googleusercontent\.com$/.test(googleIosClientId)
) {
  throw new Error(
    "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be an iOS OAuth client ID.",
  );
}
const googleIosUrlScheme = googleIosClientId
  ? `com.googleusercontent.apps.${googleIosClientId.replace(/\.apps\.googleusercontent\.com$/, "")}`
  : undefined;

// Keep identifiers configurable: choosing someone else's reverse-DNS namespace
// would make signing and future store updates unnecessarily difficult.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name || "Fable",
  slug: config.slug || "fable",
  plugins: [
    ...(config.plugins || []),
    "expo-dev-client",
    ["expo-contacts", { contactsPermission: "Allow Fable to find people you know who use Fable." }],
    ["expo-image-picker", { photosPermission: "Allow Fable to choose a profile photo or share a photo.", cameraPermission: "Allow Fable to take photos to share in your conversations.", microphonePermission: false }],
    // Explicit OAuth IDs keep the Firebase JS SDK setup independent of native Firebase files.
    ...(googleIosUrlScheme
      ? [
          [
            "./plugins/withGoogleSignIn.cjs",
            { iosUrlScheme: googleIosUrlScheme },
          ] as [string, { iosUrlScheme: string }],
        ]
      : []),
    [
      "@config-plugins/react-native-webrtc",
      {
        cameraPermission: "Allow Fable to use your camera for video calls.",
        microphonePermission: "Allow Fable to use your microphone for calls.",
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission:
          "Allow Fable to use your microphone for calls and audio messages.",
        enableBackgroundRecording: false,
        enableBackgroundPlayback: false,
      },
    ],
    "expo-sharing",
  ],
  ios: {
    ...config.ios,
    ...(process.env.IOS_BUNDLE_IDENTIFIER
      ? { bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER }
      : {}),
  },
  android: {
    ...config.android,
    ...(process.env.ANDROID_APPLICATION_ID
      ? { package: process.env.ANDROID_APPLICATION_ID }
      : {}),
  },
  extra: {
    ...config.extra,
    ...(process.env.EAS_PROJECT_ID
      ? { eas: { projectId: process.env.EAS_PROJECT_ID } }
      : {}),
  },
});
