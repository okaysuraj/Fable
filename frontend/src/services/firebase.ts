/** Firebase owns credentials and email actions; unverified SDK sessions never grant app access. */
import { FirebaseError, initializeApp, getApps } from "firebase/app";
import {
  Auth,
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
} from "firebase/auth";

let auth: Auth | undefined;
export function getFirebaseAuth(): Auth {
  if (import.meta.env.PROD && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL)
    throw new Error(
      "Firebase Auth Emulator must never be enabled in production.",
    );
  if (auth) return auth;
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  if (Object.values(config).some((value) => !value))
    throw new Error(
      "Firebase authentication is not configured. Ask your administrator to configure the Firebase project.",
    );
  auth = getAuth(getApps()[0] || initializeApp(config));
  auth.useDeviceLanguage();
  const emulator = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL;
  if (emulator && import.meta.env.DEV) connectAuthEmulator(auth, emulator);
  return auth;
}
export function authError(error: unknown): string {
  if (!(error instanceof FirebaseError))
    return error instanceof Error
      ? error.message
      : "Authentication failed. Please retry.";
  const messages: Record<string, string> = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/email-already-in-use":
      "Unable to create this account. Try logging in or resetting your password.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password":
      "Choose a stronger password that meets the project password policy.",
    "auth/too-many-requests": "Too many attempts. Please wait and retry.",
    "auth/network-request-failed":
      "Cannot connect to authentication. Check your connection and retry.",
    "auth/operation-not-allowed":
      "Email/password authentication is not enabled for this Firebase project.",
  };
  return (
    messages[error.code] ||
    "Authentication is unavailable. Please retry or contact your administrator."
  );
}
export async function register(
  email: string,
  password: string,
  name: string,
): Promise<void> {
  if (!name.trim() || name.trim().length > 80)
    throw new Error("Name must contain 1 to 80 characters.");
  if (password.length < 12)
    throw new Error("Use a password with at least 12 characters.");
  const instance = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(
    instance,
    email.trim(),
    password,
  );
  try {
    await updateProfile(credential.user, { displayName: name.trim() });
    await sendEmailVerification(credential.user);
  } finally {
    await signOut(instance);
  }
}
export async function login(email: string, password: string): Promise<void> {
  const instance = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(
    instance,
    email.trim(),
    password,
  );
  await credential.user.reload();
  if (!credential.user.emailVerified) {
    await signOut(instance);
    throw new Error(
      "Verify your email using the link in your inbox before logging in.",
    );
  }
  await credential.user.getIdToken(true);
}
export async function resendVerification(
  email: string,
  password: string,
): Promise<void> {
  const instance = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(
    instance,
    email.trim(),
    password,
  );
  try {
    if (credential.user.emailVerified)
      throw new Error("This email is already verified. You can log in.");
    await sendEmailVerification(credential.user);
  } finally {
    await signOut(instance);
  }
}
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
  } catch (error) {
    if (
      !(error instanceof FirebaseError) ||
      error.code !== "auth/user-not-found"
    )
      throw error;
  }
}
export async function logout(): Promise<void> {
  if (auth) await signOut(auth);
  localStorage.removeItem("fable_token");
  localStorage.removeItem("fable_workspace");
}
export async function getToken(
  forceRefresh = false,
): Promise<string | undefined> {
  const instance = getFirebaseAuth();
  await instance.authStateReady();
  const user = instance.currentUser;
  if (!user?.emailVerified) return undefined;
  return user.getIdToken(forceRefresh);
}
export function observeAuth(
  callback: (user: User | null) => void,
  onError: (error: unknown) => void,
): () => void {
  try {
    return onAuthStateChanged(getFirebaseAuth(), callback, onError);
  } catch (error) {
    onError(error);
    return () => {};
  }
}
