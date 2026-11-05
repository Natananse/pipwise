export const profileNameMaxLength = 80;

/** Preserve names in any language and single-word names; normalize spacing only. */
export function normalizeProfileName(value: string): string {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) {
    throw new Error('Enter your name without line breaks or control characters.');
  }
  const name = value.trim().replace(/\s+/gu, ' ');
  if (!name) throw new Error('Enter your name.');
  if (name.length > profileNameMaxLength) throw new Error(`Use a name of ${profileNameMaxLength} characters or fewer.`);
  return name;
}
