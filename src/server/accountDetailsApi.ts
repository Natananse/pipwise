import { runtimeDatabase } from './database';
import { normalizeRegistrationDetails, type RegistrationDetails } from '../lib/registrationDetails';
import { authenticate, HttpError } from './authenticate';

type StoredDetails = { country_code: string; phone_number: string | null };
type Dependencies = {
  authenticate?: typeof authenticate;
  read?: (userId: string) => Promise<RegistrationDetails | null>;
  save?: (userId: string, details: RegistrationDetails) => Promise<RegistrationDetails>;
};

function database() {
  const url = process.env.APP_RUNTIME_DATABASE_URL;
  if (!url) throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'Account details are temporarily unavailable.');
  return runtimeDatabase();
}

function fromRow(row: StoredDetails): RegistrationDetails {
  return { countryCode: row.country_code, phoneNumber: row.phone_number };
}

async function read(userId: string): Promise<RegistrationDetails | null> {
  const sql = database();
  const rows = await sql`select country_code, phone_number from public.account_details where user_id = ${userId}::uuid limit 1`;
  return rows.length ? fromRow(rows[0] as StoredDetails) : null;
}

async function save(userId: string, details: RegistrationDetails): Promise<RegistrationDetails> {
  const sql = database();
  const rows = await sql`
    insert into public.account_details (user_id, country_code, phone_number)
    values (${userId}::uuid, ${details.countryCode}, ${details.phoneNumber})
    on conflict (user_id) do update
    set country_code = excluded.country_code, phone_number = excluded.phone_number, updated_at = now()
    returning country_code, phone_number
  `;
  return fromRow(rows[0] as StoredDetails);
}

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Authorization', ...(status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}) } });
}

async function readBody(request: Request): Promise<string> {
  const tooLarge = () => new HttpError(413, 'REQUEST_TOO_LARGE', 'Account details are too large.');
  if (Number(request.headers.get('content-length')) > 2048) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'INVALID_DETAILS', 'Enter a valid country and phone number.');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let length = 0;
  let text = '';
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 2048) {
        await reader.cancel().catch(() => {});
        throw tooLarge();
      }
      text += decoder.decode(part.value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'INVALID_DETAILS', 'The account details request could not be read.');
  } finally { reader.releaseLock(); }
}

/** No caller-supplied account IDs are accepted; the verified JWT owns the row. */
export async function accountDetailsApi(request: Request, dependencies: Dependencies = {}) {
  try {
    const user = await (dependencies.authenticate || authenticate)(request);
    if (request.method === 'GET') {
      return response({ details: await (dependencies.read || read)(user.id) });
    }
    if (request.method !== 'PUT') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Use GET or PUT for account details.');
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
      throw new HttpError(415, 'JSON_REQUIRED', 'Send account details as JSON.');
    }
    // Tiny structured forms only: bound the body before parsing or writing it.
    const text = await readBody(request);
    let body: unknown;
    try { body = JSON.parse(text); }
    catch { throw new HttpError(400, 'INVALID_DETAILS', 'Enter a valid country and phone number.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'INVALID_DETAILS', 'Enter a valid country and phone number.');
    const value = body as Record<string, unknown>;
    if (Object.keys(value).some(key => !['countryCode', 'phoneNumber'].includes(key))
      || typeof value.countryCode !== 'string' || (value.phoneNumber !== undefined && value.phoneNumber !== null && typeof value.phoneNumber !== 'string')) {
      throw new HttpError(400, 'INVALID_DETAILS', 'Send only your country and optional phone number.');
    }
    let details: RegistrationDetails;
    try { details = normalizeRegistrationDetails({ countryCode: value.countryCode, phoneNumber: value.phoneNumber as string | null | undefined }); }
    catch (error) { throw new HttpError(400, 'INVALID_DETAILS', error instanceof Error ? error.message : 'Enter a valid country and phone number.'); }
    return response({ details: await (dependencies.save || save)(user.id, details) });
  } catch (error) {
    return error instanceof HttpError ? response({ error: { code: error.code, message: error.message } }, error.status)
      : response({ error: { code: 'ACCOUNT_DETAILS_UNAVAILABLE', message: 'Your account details could not be saved or loaded. Please try again.' } }, 503);
  }
}
