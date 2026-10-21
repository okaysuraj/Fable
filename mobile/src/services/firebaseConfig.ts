/** Public Firebase client configuration, shared by native and Expo web adapters. */
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID?.trim(),
};
export const firebaseConfigured = Object.values(firebaseConfig).every((value) =>
  Boolean(
    value &&
    !/REPLACE_WITH|^your[-_]|^placeholder(?:[-_]|$)|^mock(?:[-_]|$)/i.test(
      value,
    ),
  ),
);
