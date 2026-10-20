/** Metro uses the native implementation for installed iOS and Android apps. */
export const googleSignInUnavailableReason =
  "Google sign-in is available in the installed iPhone and Android apps.";
export async function getGoogleIdToken(): Promise<string | null> {
  throw new Error(googleSignInUnavailableReason);
}
