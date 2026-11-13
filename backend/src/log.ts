/**
 * Tiny structured logger.
 *
 * Privacy rule: never pass image data, data URIs or full request bodies here.
 * Log ids, timings and error codes only. As a safety net, any string that looks
 * like base64 image data is replaced before printing.
 */

type Level = 'info' | 'warn' | 'error';
type Fields = Record<string, string | number | boolean | null | undefined>;

const LOOKS_LIKE_IMAGE = /data:image\/|^[A-Za-z0-9+/=]{500,}$/;

function redact(fields: Fields): Fields {
  const safe: Fields = {};
  for (const [key, value] of Object.entries(fields)) {
    safe[key] = typeof value === 'string' && LOOKS_LIKE_IMAGE.test(value) ? '[redacted-image]' : value;
  }
  return safe;
}

export function log(level: Level, event: string, fields: Fields = {}): void {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...redact(fields) });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
