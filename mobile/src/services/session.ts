/** Own Firebase email actions, verified session provisioning and device-local workspace selection. */
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  reload,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  validatePassword,
  type User as FirebaseUser,
} from "firebase/auth";
import { getFirebaseAuth } from "./firebase";
import { FirebaseError } from "firebase/app";
import type { User } from "@/types/chat";
import { ApiError, requestJson } from "./request";
import { firebaseConfigured } from "./firebaseConfig";
import { getGoogleIdToken } from "./googleSignIn";

export { ApiError } from "./request";
export function authError(error: unknown): string {
  if (!(error instanceof FirebaseError))
    return error instanceof Error
      ? error.message
      : "Authentication failed. Please try again.";
  const messages: Record<string, string> = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-not-found": "Email or password is incorrect.",
    "auth/wrong-password": "Email or password is incorrect.",
    "auth/email-already-in-use":
      "Unable to create this account. Try signing in or resetting your password.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password":
      "Choose a stronger password that meets the password policy.",
    "auth/password-does-not-meet-requirements":
      "Choose a password that meets the configured password policy.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/network-request-failed":
      "Cannot reach authentication. Check your connection and try again.",
    "auth/invalid-api-key":
      "Firebase sign-in isn't configured correctly for this build.",
    "auth/app-not-authorized":
      "This app isn't authorized for the configured Firebase project.",
    "auth/configuration-not-found":
      "Enable Email/Password and Google sign-in in Firebase Authentication.",
    "auth/operation-not-allowed":
      "This sign-in method hasn't been enabled for Fable yet.",
    "auth/account-exists-with-different-credential":
      "This account uses another sign-in method. Sign in with the method you originally used.",
    "auth/user-disabled":
      "Your account is unavailable. Contact your administrator.",
  };
  return (
    messages[error.code] ||
    "Authentication is unavailable. Please try again or contact your administrator."
  );
}
const TOKEN_KEY = "fable_token";
let legacyCleanup: Promise<void> | undefined;
let selectedWorkspace: string | null = null;
let workspaceLoaded = false;

export function onSessionExpired(listener: () => void): () => void {
  if (!firebaseConfigured) return () => {};
  const auth = getFirebaseAuth();
  let previouslySignedIn = Boolean(auth.currentUser);
  return onAuthStateChanged(auth, (user) => {
    if (!user && previouslySignedIn) listener();
    previouslySignedIn = Boolean(user);
  });
}

export async function getSessionToken(): Promise<string | null> {
  // Obsolete locally signed sessions must not become Firebase sessions.
  await (legacyCleanup ??= AsyncStorage.multiRemove([
    TOKEN_KEY,
    "fable_development_session",
  ]));
  if (!firebaseConfigured) return null;
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return null;
  try {
    return await user.getIdToken();
  } catch (error) {
    if (
      error instanceof FirebaseError &&
      [
        "auth/user-disabled",
        "auth/user-token-expired",
        "auth/invalid-user-token",
      ].includes(error.code)
    ) {
      await signOut(auth);
      return null;
    }
    throw error;
  }
}

export async function selectWorkspace(id: string | null): Promise<void> {
  selectedWorkspace = id;
  workspaceLoaded = true;
  if (id) await AsyncStorage.setItem("fable_workspace", id);
  else await AsyncStorage.removeItem("fable_workspace");
}

export function getSelectedWorkspaceId(): string | null {
  return selectedWorkspace;
}

export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) {
    const url = new URL(configured);
    if (url.username || url.password || url.search || url.hash) {
      throw new Error(
        "API URL must not contain credentials, queries, or fragments.",
      );
    }
    if (url.protocol !== "https:" && (!__DEV__ || url.protocol !== "http:")) {
      throw new Error("A secure HTTPS API URL is required.");
    }
    return configured.replace(/\/+$/, "");
  }
  if (!__DEV__)
    throw new Error("EXPO_PUBLIC_API_URL must be configured for production.");
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = new URL(`http://${hostUri}`).hostname;
    return `http://${host}:5000/api`;
  }
  return Platform.OS === "android"
    ? "http://10.0.2.2:5000/api"
    : "http://localhost:5000/api";
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  responseType: "json" | "blob" = "json",
  workspaceIdOverride?: string,
): Promise<T> {
  const token = await getSessionToken();
  if (!token) throw new ApiError("Please sign in to continue.", 401);
  if (!workspaceLoaded) {
    selectedWorkspace = await AsyncStorage.getItem("fable_workspace");
    workspaceLoaded = true;
  }
  try {
    const identityWorkspaceRead =
      (!init.method || init.method === "GET") &&
      (/^\/workspace(?:\?|$)/.test(path) ||
        /^\/workspace\/(?!audit(?:\?|$)|invitations(?:\?|$))[^/?]+(?:\?|$)/.test(
          path,
        ));
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
    headers.set("Authorization", `Bearer ${token}`);
    if (
      (workspaceIdOverride || selectedWorkspace) &&
      !path.startsWith("/auth/") &&
      !identityWorkspaceRead
    )
      headers.set("X-Workspace-Id", workspaceIdOverride || selectedWorkspace!);
    return await requestJson<T>(
      `${getApiBaseUrl()}${path}`,
      {
        ...init,
        headers,
      },
      15000,
      responseType,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await signOut(getFirebaseAuth());
      await selectWorkspace(null);
    }
    throw error;
  }
}

export interface AuthResponse {
  user: User;
}
export interface RegistrationResponse {
  verificationSent: true;
}
export class EmailVerificationRequiredError extends Error {
  constructor(
    message = "Verify your email using the link in your inbox before signing in.",
  ) {
    super(message);
    this.name = "EmailVerificationRequiredError";
  }
}

async function authenticate(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const auth = getFirebaseAuth();
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return finishAuthentication(result.user);
}

async function finishAuthentication(user: FirebaseUser): Promise<AuthResponse> {
  await reload(user);
  if (!user.emailVerified) {
    await signOut(getFirebaseAuth());
    throw new EmailVerificationRequiredError();
  }
  await user.getIdToken(true);
  await selectWorkspace(null);
  const response = await request<{ user: User }>("/auth/session", {
    method: "POST",
  });
  return { user: response.user };
}

export const session = {
  async register(
    email: string,
    password: string,
    name: string,
  ): Promise<RegistrationResponse> {
    if (password.length < 12)
      throw new Error("Use at least 12 characters for your password.");
    if (!name.trim() || name.trim().length > 80)
      throw new Error("Enter a name between 1 and 80 characters.");
    const auth = getFirebaseAuth();
    const policy = await validatePassword(auth, password);
    if (!policy.isValid) {
      const requirements: string[] = [];
      const strength = policy.passwordPolicy.customStrengthOptions;
      if (policy.meetsMinPasswordLength === false)
        requirements.push(`at least ${strength.minPasswordLength} characters`);
      if (policy.meetsMaxPasswordLength === false)
        requirements.push(`at most ${strength.maxPasswordLength} characters`);
      if (policy.containsLowercaseLetter === false)
        requirements.push("a lowercase letter");
      if (policy.containsUppercaseLetter === false)
        requirements.push("an uppercase letter");
      if (policy.containsNumericCharacter === false)
        requirements.push("a number");
      if (policy.containsNonAlphanumericCharacter === false)
        requirements.push("a special character");
      throw new Error(
        requirements.length
          ? `Your password needs ${requirements.join(", ")}.`
          : "Choose a password that meets the password policy.",
      );
    }
    const result = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    );
    try {
      await updateProfile(result.user, { displayName: name.trim() });
      await sendEmailVerification(result.user);
      return { verificationSent: true };
    } catch {
      throw new EmailVerificationRequiredError(
        "Your account was created, but we couldn't confirm the verification email was sent. Enter your email and password, then resend the verification link.",
      );
    } finally {
      await signOut(auth);
    }
  },
  login: authenticate,
  async loginWithGoogle(): Promise<AuthResponse | null> {
    const auth = getFirebaseAuth();
    const idToken = await getGoogleIdToken();
    if (!idToken) return null;
    const result = await signInWithCredential(
      auth,
      GoogleAuthProvider.credential(idToken),
    );
    return finishAuthentication(result.user);
  },
  async fetchMe(
    options: { signal?: AbortSignal } = {},
  ): Promise<{ user: User }> {
    try {
      return await request<{ user: User }>("/auth/me", {
        signal: options.signal,
      });
    } catch (error) {
      // Recover a verified SDK sign-in whose first provisioning request was interrupted.
      if (
        error instanceof ApiError &&
        error.status === 403 &&
        error.message === "Create your Fable session first"
      ) {
        return request<{ user: User }>("/auth/session", {
          method: "POST",
          signal: options.signal,
        });
      }
      throw error;
    }
  },
  async resendVerification(email: string, password: string): Promise<void> {
    const auth = getFirebaseAuth();
    const result = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    );
    try {
      await reload(result.user);
      if (result.user.emailVerified)
        throw new Error("Your email is already verified. You can sign in.");
      await sendEmailVerification(result.user);
    } finally {
      await signOut(auth);
    }
  },
  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
    } catch (error) {
      if (
        !(error instanceof FirebaseError) ||
        error.code !== "auth/user-not-found"
      )
        throw error;
    }
  },
  async logout(): Promise<void> {
    // Normal sign-out affects this device. Server revocation is an explicit all-device action.
    try {
      if (firebaseConfigured) await signOut(getFirebaseAuth());
    } finally {
      await selectWorkspace(null);
    }
  },
  async logoutAllDevices(): Promise<void> {
    await request("/auth/logout", { method: "POST" });
    await signOut(getFirebaseAuth());
    await selectWorkspace(null);
  },
};
