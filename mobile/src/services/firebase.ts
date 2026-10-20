/** Initialize Firebase for Expo web; Metro selects firebase.native.ts on iOS and Android. */
import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { firebaseConfig, firebaseConfigured } from "./firebaseConfig";

let instance: Auth | undefined;
export function getFirebaseAuth(): Auth {
  if (instance) return instance;
  if (!firebaseConfigured) {
    throw new Error(
      "Firebase is not configured. Set the EXPO_PUBLIC_FIREBASE_* environment variables.",
    );
  }
  const emulator = process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
  if (emulator && !__DEV__)
    throw new Error(
      "Firebase emulator must never be enabled in a production app.",
    );
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  instance = getAuth(app);
  if (emulator)
    connectAuthEmulator(instance, emulator, { disableWarnings: true });
  return instance;
}
