export function kbToBytes(kb: string) {
  const n = Number(kb);
  if (!Number.isFinite(n) || n < 0) return "0";
  return String(Math.round(n * 1024));
}

export function bytesToKbInput(bytes: string) {
  const n = Number(bytes);
  if (!Number.isFinite(n)) return "0";
  if (n < 0) return ""; // unlimited sentinel in the limited form
  if (n === 0) return "0";
  return String(Math.round(n / 1024));
}
