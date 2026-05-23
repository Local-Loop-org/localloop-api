import { BadRequestException } from '@nestjs/common';
import {
  decodeJsonCursor,
  encodeJsonCursor,
  parseStringIdCursor,
  parseTimestampIdCursor,
} from './cursor.utils';

describe('encodeJsonCursor / decodeJsonCursor', () => {
  it('round-trips an object through encode → decode', () => {
    const obj = { lastActivityAt: '2026-05-17T12:00:00.000Z', groupId: 'g-1' };
    const encoded = encodeJsonCursor(obj);
    const decoded = decodeJsonCursor(encoded);
    expect(decoded).toEqual(obj);
  });

  it('throws INVALID_CURSOR for non-base64url input', () => {
    expect(() => decodeJsonCursor('!!!not-base64!!!')).toThrow(
      BadRequestException,
    );
  });
});

describe('parseTimestampIdCursor', () => {
  const TS_FIELD = 'lastMessageAt';
  const ID_FIELD = 'peerId';
  const DATE = new Date('2026-05-17T10:00:00Z');

  const validCursor = () =>
    encodeJsonCursor({
      [TS_FIELD]: DATE.toISOString(),
      [ID_FIELD]: 'user-b',
    });

  it('returns parsed timestamp and id for a valid cursor', () => {
    const result = parseTimestampIdCursor(validCursor(), TS_FIELD, ID_FIELD);
    expect(result.timestamp).toEqual(DATE);
    expect(result.id).toBe('user-b');
  });

  it('throws INVALID_CURSOR when timestamp field is missing', () => {
    const cursor = encodeJsonCursor({ [ID_FIELD]: 'user-b' });
    expect(() => parseTimestampIdCursor(cursor, TS_FIELD, ID_FIELD)).toThrow(
      BadRequestException,
    );
  });

  it('throws INVALID_CURSOR when id field is missing', () => {
    const cursor = encodeJsonCursor({ [TS_FIELD]: DATE.toISOString() });
    expect(() => parseTimestampIdCursor(cursor, TS_FIELD, ID_FIELD)).toThrow(
      BadRequestException,
    );
  });

  it('throws INVALID_CURSOR when timestamp is not a valid ISO string', () => {
    const cursor = encodeJsonCursor({
      [TS_FIELD]: 'not-a-date',
      [ID_FIELD]: 'user-b',
    });
    expect(() => parseTimestampIdCursor(cursor, TS_FIELD, ID_FIELD)).toThrow(
      BadRequestException,
    );
  });

  it('throws INVALID_CURSOR for a completely malformed cursor string', () => {
    expect(() =>
      parseTimestampIdCursor('garbage!!!', TS_FIELD, ID_FIELD),
    ).toThrow(BadRequestException);
  });
});

describe('parseStringIdCursor', () => {
  const F1 = 'displayName';
  const F2 = 'userId';

  const validCursor = () => encodeJsonCursor({ [F1]: 'Alice', [F2]: 'user-1' });

  it('returns both string values for a valid cursor', () => {
    const result = parseStringIdCursor(validCursor(), F1, F2);
    expect(result.value1).toBe('Alice');
    expect(result.value2).toBe('user-1');
  });

  it('throws INVALID_CURSOR when the first field is missing', () => {
    const cursor = encodeJsonCursor({ [F2]: 'user-1' });
    expect(() => parseStringIdCursor(cursor, F1, F2)).toThrow(
      BadRequestException,
    );
  });

  it('throws INVALID_CURSOR when the second field is missing', () => {
    const cursor = encodeJsonCursor({ [F1]: 'Alice' });
    expect(() => parseStringIdCursor(cursor, F1, F2)).toThrow(
      BadRequestException,
    );
  });

  it('throws INVALID_CURSOR when a field is the wrong type', () => {
    const cursor = encodeJsonCursor({ [F1]: 'Alice', [F2]: 42 });
    expect(() => parseStringIdCursor(cursor, F1, F2)).toThrow(
      BadRequestException,
    );
  });

  it('throws INVALID_CURSOR for a completely malformed cursor string', () => {
    expect(() => parseStringIdCursor('garbage!!!', F1, F2)).toThrow(
      BadRequestException,
    );
  });
});
