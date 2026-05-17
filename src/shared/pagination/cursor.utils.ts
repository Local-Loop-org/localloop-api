import { BadRequestException } from '@nestjs/common';

export function encodeJsonCursor(obj: object): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

export function decodeJsonCursor(raw: string): unknown {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    return JSON.parse(json) as unknown;
  } catch {
    throw new BadRequestException({ error: 'INVALID_CURSOR' });
  }
}

/**
 * Shared helper for the common (ISO-timestamp, UUID) cursor pattern.
 * Decodes the base64url cursor and validates that it has the expected fields.
 */
export function parseTimestampIdCursor(
  raw: string,
  timestampField: string,
  idField: string,
): { timestamp: Date; id: string } {
  const decoded = decodeJsonCursor(raw);
  const d = decoded as Record<string, unknown>;
  if (
    !decoded ||
    typeof decoded !== 'object' ||
    typeof d[timestampField] !== 'string' ||
    typeof d[idField] !== 'string'
  ) {
    throw new BadRequestException({
      error: 'INVALID_CURSOR',
      message: 'Cursor payload is missing required fields',
    });
  }
  const date = new Date(d[timestampField] as string);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({
      error: 'INVALID_CURSOR',
      message: 'Cursor timestamp is not a valid ISO timestamp',
    });
  }
  return { timestamp: date, id: d[idField] as string };
}
