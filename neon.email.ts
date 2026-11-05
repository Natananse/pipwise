/// <reference types="node" />
import { defineConfig } from '@neon/config/v1';

function requiredEnv(name: string, value: string | undefined): string {
  if (!value?.trim()) throw new Error(`Missing relay configuration: ${name}`);
  if (name === 'PIPWISE_AUTH_EMAIL_ENABLED' && value !== '0' && value !== '1') {
    throw new Error('Relay delivery gate must be explicitly 0 or 1.');
  }
  if (name === 'PIPWISE_AUTH_EMAIL_RELAY_SECRET' && !/^[\x21-\x7e]{43,512}$/.test(value)) {
    throw new Error('Relay origin secret must contain at least 43 printable characters.');
  }
  return value;
}

// Optional relay policy only. Use an explicitly selected supported-region Free
// project; never apply this policy to the app's existing London project.
// The existing app server forwards original signed headers under X-PipWise-Neon-*
// with a private origin secret because the Functions edge strips X-Neon-*.
export default defineConfig({
  functions: {
    authmail: {
      name: 'PipWise auth email relay',
      source: 'src/functions/authEmail.ts',
      env: {
        // Enable only after SMTP has been verified without sending a message.
        PIPWISE_AUTH_EMAIL_ENABLED: requiredEnv('PIPWISE_AUTH_EMAIL_ENABLED', process.env.PIPWISE_AUTH_EMAIL_ENABLED),
        PIPWISE_AUTH_EMAIL_RELAY_SECRET: requiredEnv('PIPWISE_AUTH_EMAIL_RELAY_SECRET', process.env.PIPWISE_AUTH_EMAIL_RELAY_SECRET),
        PIPWISE_ORIGIN_AUTH_BASE_URL: requiredEnv('PIPWISE_ORIGIN_AUTH_BASE_URL', process.env.PIPWISE_ORIGIN_AUTH_BASE_URL),
        PIPWISE_ORIGIN_AUTH_JWKS_URL: requiredEnv('PIPWISE_ORIGIN_AUTH_JWKS_URL', process.env.PIPWISE_ORIGIN_AUTH_JWKS_URL),
        PIPWISE_AUTH_DATABASE_URL: requiredEnv('PIPWISE_AUTH_DATABASE_URL', process.env.PIPWISE_AUTH_DATABASE_URL),
        PIPWISE_SMTP_USER: requiredEnv('PIPWISE_SMTP_USER', process.env.PIPWISE_SMTP_USER),
        PIPWISE_SMTP_APP_PASSWORD: requiredEnv('PIPWISE_SMTP_APP_PASSWORD', process.env.PIPWISE_SMTP_APP_PASSWORD),
      },
    },
  },
});
