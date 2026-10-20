import Constants from "expo-constants";
import { Platform } from "react-native";
import { firebaseConfigured } from "./firebaseConfig";

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
const validClientId = (value: string | undefined) =>
  Boolean(value && /^[\w-]+\.apps\.googleusercontent\.com$/.test(value));

export const googleSignInUnavailableReason =
  !firebaseConfigured ||
  !validClientId(webClientId) ||
  (Platform.OS === "ios" && !validClientId(iosClientId))
    ? "Google sign-in isn't configured for this build yet."
    : Constants.executionEnvironment === "storeClient"
      ? "Google sign-in is available in the installed Fable app."
      : null;

// Lazy loading keeps email/password and local development usable without the native Google module.
let sdkPromise:
  Promise<typeof import("react-native-nitro-google-signin")> | undefined;
async function getSdk() {
  sdkPromise ??= import("react-native-nitro-google-signin").catch(() => {
    sdkPromise = undefined;
    throw new Error(
      "Google sign-in needs an updated Fable native build. Rebuild the app after configuring sign-in.",
    );
  });
  return sdkPromise;
}

export async function getGoogleIdToken(): Promise<string | null> {
  if (googleSignInUnavailableReason)
    throw new Error(googleSignInUnavailableReason);
  if (!webClientId)
    throw new Error("Google sign-in isn't configured for this build yet.");
  const sdk = await getSdk();
  try {
    sdk.GoogleOneTapSignIn.configure({
      webClientId,
      iosClientId,
      offlineAccess: false,
      autoSelectOnSignIn: false,
    });
    await sdk.GoogleOneTapSignIn.checkPlayServices();
    const response = await sdk.GoogleOneTapSignIn.presentExplicitSignIn();
    if (sdk.isCancelledResponse(response)) return null;
    if (!sdk.isSuccessResponse(response) || !response.data.idToken)
      throw new Error("Google couldn't complete sign-in. Please try again.");
    const idToken = response.data.idToken;
    // Firebase owns the persistent app session; Google is only the credential bootstrap.
    // SDK sign-out clears its local cache without revoking this already-issued ID token.
    await sdk.GoogleOneTapSignIn.signOut();
    return idToken;
  } catch (error) {
    if (sdk.isErrorWithCode(error)) {
      if (error.code === sdk.statusCodes.SIGN_IN_CANCELLED) return null;
      if (error.code === sdk.statusCodes.PLAY_SERVICES_NOT_AVAILABLE)
        throw new Error(
          "Update Google Play Services on this device, then try again.",
        );
      if (error.code === sdk.statusCodes.DEVELOPER_ERROR)
        throw new Error(
          "Google sign-in isn't configured for this app's signing certificate. Check the app registration before trying again.",
        );
      if (error.code === sdk.statusCodes.IN_PROGRESS)
        throw new Error(
          "A Google sign-in is already in progress. Please wait.",
        );
    }
    throw new Error("Google sign-in couldn't complete. Please try again.");
  }
}
