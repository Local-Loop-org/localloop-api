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
