export function allowedLocalRequest(
  headers: Headers,
  method: string,
  origin: string,
) {
  const expected = new URL(origin);
  if (headers.get('host') !== expected.host) return false;
  const suppliedOrigin = headers.get('origin');
  if (suppliedOrigin !== null && suppliedOrigin !== origin) return false;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && suppliedOrigin !== origin)
    return false;
  return true;
}
