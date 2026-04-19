import { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service';

const getUser = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { getUser },
  })),
}));

describe('SupabaseService', () => {
  let service: SupabaseService;

  const buildConfig = (): ConfigService =>
    ({
      get: jest.fn((key: string) => {
        if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-key';
        return undefined;
      }),
    }) as unknown as ConfigService;

  beforeEach(() => {
    getUser.mockReset();
    service = new SupabaseService(buildConfig());
  });

  describe('verifyGoogleToken', () => {
    it('maps supabase response to the google metadata shape', async () => {
      getUser.mockResolvedValue({
        data: {
          user: {
            id: 'sb-id',
            email: 'alice@example.com',
            user_metadata: {
              full_name: 'Alice',
              avatar_url: 'https://avatar.png',
            },
            identities: [
              { provider: 'google', id: 'google-sub-1' },
              { provider: 'email', id: 'noise' },
            ],
          },
        },
        error: null,
      });

      const result = await service.verifyGoogleToken('token');

      expect(getUser).toHaveBeenCalledWith('token');
      expect(result.error).toBeNull();
      expect(result.data?.user).toEqual({
        id: 'sb-id',
        email: 'alice@example.com',
        user_metadata: {
          full_name: 'Alice',
          avatar_url: 'https://avatar.png',
          provider_id: 'google-sub-1',
        },
      });
    });

    it('falls back to name + picture when full_name/avatar_url are absent', async () => {
      getUser.mockResolvedValue({
        data: {
          user: {
            id: 'sb-id',
            email: 'alice@example.com',
            user_metadata: { name: 'Ali', picture: 'https://pic.png' },
            identities: [{ provider: 'google', id: 'g-1' }],
          },
        },
        error: null,
      });

      const result = await service.verifyGoogleToken('token');

      expect(result.data?.user.user_metadata.full_name).toBe('Ali');
      expect(result.data?.user.user_metadata.avatar_url).toBe(
        'https://pic.png',
      );
    });

    it('falls back to supabase user id when no google identity is present', async () => {
      getUser.mockResolvedValue({
        data: {
          user: {
            id: 'sb-id',
            email: 'x@example.com',
            user_metadata: {},
            identities: [],
          },
        },
        error: null,
      });

      const result = await service.verifyGoogleToken('token');

      expect(result.data?.user.user_metadata.provider_id).toBe('sb-id');
    });

    it('propagates errors from supabase', async () => {
      getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid jwt' },
      });

      const result = await service.verifyGoogleToken('bad');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'invalid jwt' });
    });
  });

  describe('verifyAppleToken', () => {
    it('maps supabase response to the apple metadata shape', async () => {
      getUser.mockResolvedValue({
        data: {
          user: {
            id: 'sb-id',
            email: 'bob@example.com',
            user_metadata: {
              full_name: 'Bob',
              avatar_url: 'https://apple.png',
            },
            identities: [
              { provider: 'apple', id: 'apple-sub-1' },
              { provider: 'google', id: 'noise' },
            ],
          },
        },
        error: null,
      });

      const result = await service.verifyAppleToken('token');

      expect(getUser).toHaveBeenCalledWith('token');
      expect(result.data?.user.user_metadata.provider_id).toBe('apple-sub-1');
      expect(result.error).toBeNull();
    });

    it('propagates errors from supabase', async () => {
      getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid' },
      });

      const result = await service.verifyAppleToken('bad');

      expect(result.data).toBeNull();
      expect(result.error).toEqual({ message: 'invalid' });
    });
  });
});
