/** Firebase is the sole identity provider for HTTP, realtime and background delivery. */
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth, type Auth, type DecodedIdToken } from "firebase-admin/auth";
import { z } from "zod";
import { HttpError } from "./http.js";
import "./config.js";

export interface VerifiedIdentity {
  uid: string;
  email: string;
  name?: string;
}
export class FirebaseIdentityError extends HttpError {
  constructor(
    status: number,
    public code: string,
    message: string,
  ) {
    super(status, message);
  }
}
const placeholder =
  /REPLACE_WITH|^your[-_]|^placeholder(?:[-_]|$)|^mock(?:[-_]|$)/i;
export function firebaseProjectConfigured() {
  const id = process.env.FIREBASE_PROJECT_ID?.trim();
  return Boolean(id && !placeholder.test(id) && !id.startsWith("demo-"));
}
function configurationError(): never {
  throw new FirebaseIdentityError(
    503,
    "AUTH_NOT_CONFIGURED",
    "Firebase Authentication is not configured on the server.",
  );
}
const serviceAccountSchema = z.union([
  z
    .object({
      project_id: z.string(),
      client_email: z.email(),
      private_key: z.string(),
    })
    .transform((value) => ({
      projectId: value.project_id,
      clientEmail: value.client_email,
      privateKey: value.private_key,
    })),
  z.object({
    projectId: z.string(),
    clientEmail: z.email(),
    privateKey: z.string(),
  }),
]);
let auth: Auth | undefined;
export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    (emulator ? "demo-fable" : undefined);
  if (!projectId || placeholder.test(projectId)) configurationError();
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  let account: z.infer<typeof serviceAccountSchema> | undefined;
  try {
    if (json) account = serviceAccountSchema.parse(JSON.parse(json));
    else if (clientEmail || privateKey)
      account = serviceAccountSchema.parse({
        projectId,
        clientEmail,
        privateKey,
      });
    if (
      account &&
      (account.projectId !== projectId ||
        placeholder.test(account.clientEmail) ||
        !account.privateKey.includes("-----BEGIN PRIVATE KEY-----"))
    )
      configurationError();
    const existing = getApps().find((app) => app.name === "[DEFAULT]");
    if (existing && existing.options.projectId !== projectId)
      configurationError();
    const app =
      existing ||
      initializeApp({
        projectId,
        credential: account ? cert(account) : applicationDefault(),
      });
    auth = getAuth(app);
    return auth;
  } catch (error) {
    if (error instanceof FirebaseIdentityError) throw error;
    configurationError();
  }
}

export async function verifyFirebaseIdentity(
  token: string,
): Promise<VerifiedIdentity> {
  if (token.length > 8192 || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token))
    throw new FirebaseIdentityError(
      401,
      "AUTH_SESSION_INVALID",
      "Invalid authentication session",
    );
  let identity: DecodedIdToken;
  try {
    identity = await getFirebaseAuth().verifyIdToken(token, true);
  } catch (error) {
    if (error instanceof FirebaseIdentityError) throw error;
    const code = (error as { code?: string }).code || "";
    if (
      [
        "auth/id-token-expired",
        "auth/id-token-revoked",
        "auth/invalid-id-token",
        "auth/argument-error",
        "auth/user-disabled",
        "auth/user-not-found",
      ].includes(code)
    )
      throw new FirebaseIdentityError(
        401,
        "AUTH_SESSION_INVALID",
        "Invalid or expired authentication session",
      );
    throw new FirebaseIdentityError(
      503,
      "AUTH_UNAVAILABLE",
      "Authentication is temporarily unavailable. Try again shortly.",
    );
  }
  if (!["password", "google.com"].includes(identity.firebase.sign_in_provider))
    throw new FirebaseIdentityError(
      403,
      "AUTH_PROVIDER_UNSUPPORTED",
      "Sign in with email/password or Google",
    );
  if (!identity.email_verified || !identity.email)
    throw new FirebaseIdentityError(
      403,
      "EMAIL_VERIFICATION_REQUIRED",
      "Verify your email before accessing Fable",
    );
  return {
    uid: identity.uid,
    email: identity.email,
    ...(typeof identity.name === "string" ? { name: identity.name } : {}),
  };
}
