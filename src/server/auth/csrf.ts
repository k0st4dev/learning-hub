import { randomBytes, createHmac } from 'node:crypto';
import { digest, equalSecret } from './crypto.ts';
export const csrfCookieName = 'learning_csrf';
function mac(secret: string, scope: string | undefined, payload: string) {
  return createHmac('sha256', secret)
    .update(`${digest(scope ?? 'anonymous')}:${payload}`)
    .digest('hex');
}
export function createCsrf(
  secret: string,
  session: string | undefined,
  now = Date.now(),
) {
  const payload = `${now}.${randomBytes(32).toString('hex')}`;
  return `${payload}.${mac(secret, session, payload)}`;
}
export function verifyCsrf(
  secret: string,
  session: string | undefined,
  cookie: string | undefined,
  header: string | null,
  now = Date.now(),
) {
  if (!cookie || !header || !equalSecret(cookie, header)) return false;
  const parts = header.split('.');
  if (parts.length !== 3) return false;
  const [time, nonce, signature] = parts;
  if (
    !time ||
    !nonce ||
    !signature ||
    !/^\d{13}$/.test(time) ||
    !/^[a-f0-9]{64}$/.test(nonce)
  )
    return false;
  if (Number(time) > now || now - Number(time) > 3600000) return false;
  return equalSecret(signature, mac(secret, session, `${time}.${nonce}`));
}
