/** Release bundles always use Firebase; the bypass exists only in Expo development. */
export const devAuthEnabled =
  __DEV__ && process.env.EXPO_PUBLIC_DEV_AUTH_ENABLED === "true";
