import type { ClientConfig } from "pg";
export function quoteIdentifier(value: string): string;
export function parseDatabaseUrl(
  value: string | undefined,
  label: string,
  options?: { allowLocal?: boolean; direct?: boolean; schema?: string },
): URL;
export function databaseEnvironment(env?: NodeJS.ProcessEnv): {
  schema: string;
  runtimeUrl: string;
  directUrl: string;
  eventUrl: string;
};
export function pgConnectionOptions(
  url: string | URL,
  applicationName: string,
  caPath?: string,
): Promise<ClientConfig>;
