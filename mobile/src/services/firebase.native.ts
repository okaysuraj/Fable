/** Initialize Firebase with serialized Keychain/Keystore persistence on native platforms. */
import { FirebaseError, getApp, getApps, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  initializeAuth,
  type Auth,
  type Persistence,
} from "firebase/auth";
import * as FirebaseAuth from "firebase/auth";
import * as SecureStore from "expo-secure-store";
import { createSecurePersistence } from "./securePersistence";

let instance: Auth | undefined;

// Firebase refresh credentials live in Keychain/Keystore on native platforms.
// Chunking avoids historical iOS SecureStore limits on large persisted users.
const storage = createSecurePersistence({
  getItemAsync: (key) => SecureStore.getItemAsync(key),
  setItemAsync: (key, value) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
});

export function getFirebaseAuth(): Auth {
  if (instance) return instance;
  const config = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
  if (Object.values(config).some((value) => !value)) {
    throw new Error(
      "Firebase is not configured. Set the EXPO_PUBLIC_FIREBASE_* environment variables.",
    );
  }
  const emulator = process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
  if (emulator && !__DEV__)
    throw new Error(
      "Firebase emulator must never be enabled in a production app.",
    );
  const app = getApps().length ? getApp() : initializeApp(config);
  // The SDK's native entry exports this documented API; its generic web types do not.
  const nativeSdk = FirebaseAuth as typeof FirebaseAuth & {
    getReactNativePersistence(value: typeof storage): Persistence;
  };
  try {
    instance = initializeAuth(app, {
      persistence: nativeSdk.getReactNativePersistence(storage),
    });
  } catch (error) {
    // Fast Refresh can reload this module while the secure-persistence Auth exists.
    if (
      !__DEV__ ||
      !(error instanceof FirebaseError) ||
      error.code !== "auth/already-initialized"
    )
      throw error;
    instance = getAuth(app);
  }
  if (emulator) {
    connectAuthEmulator(instance, emulator, { disableWarnings: true });
  }
  return instance;
}
