export type DatabaseEnvironment = Record<string, string | undefined>;

export class DatabaseConfigError extends Error {
  constructor(message: string);
}

export function databaseConnectionString(
  env: DatabaseEnvironment,
  options: { variable: string; role: string; direct?: boolean },
): string;

export function safeDatabaseErrorCode(error: unknown): string | null;
