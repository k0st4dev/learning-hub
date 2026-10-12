/** Shared size policy; the bundled compromised-password list stays server-only. */
export function validPasswordSize(value: string) {
  const characters = [...value].length;
  return (
    characters >= 15 &&
    characters <= 128 &&
    new TextEncoder().encode(value).length <= 512
  );
}
