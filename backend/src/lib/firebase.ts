/** One Firebase Admin client verifies identities against the configured project. */
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import "./config.js";

let auth: Auth | undefined;
export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    (process.env.FIREBASE_AUTH_EMULATOR_HOST ? "demo-fable" : undefined);
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const app =
    getApps()[0] ||
    initializeApp({
      projectId,
      credential: serviceAccountJson
        ? cert(JSON.parse(serviceAccountJson) as ServiceAccount)
        : applicationDefault(),
    });
  auth = getAuth(app);
  return auth;
}
