import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { Provider } from '@localloop/shared-types';

import { AuthTestApp, setupAuthTestApp } from './helpers/setup-auth-test-app';
import { InMemoryUserRepository } from './helpers/in-memory-user.repository';
import { buildUser } from './helpers/user.factory';
import { SupabaseService } from '../src/shared/supabase/supabase.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let userRepo: InMemoryUserRepository;
  let supabase: jest.Mocked<SupabaseService>;
  let jwtService: JwtService;
  let ctx: AuthTestApp;

  beforeAll(async () => {
    ctx = await setupAuthTestApp();
    app = ctx.app;
    userRepo = ctx.userRepo;
    supabase = ctx.supabase;
    jwtService = ctx.jwtService;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    userRepo.clear();
    (supabase.verifyGoogleToken as jest.Mock).mockReset();
    (supabase.verifyAppleToken as jest.Mock).mockReset();
  });

  const googleOk = (overrides: Record<string, unknown> = {}) => ({
    data: {
      user: {
        id: 'supabase-g-1',
        email: 'alice@example.com',
        user_metadata: {
          full_name: 'Alice',
          avatar_url: 'https://avatar.png',
          provider_id: 'google-sub-1',
          ...overrides,
        },
      },
    },
    error: null,
  });

  const appleOk = (overrides: Record<string, unknown> = {}) => ({
    data: {
      user: {
        id: 'supabase-a-1',
        email: 'bob@example.com',
        user_metadata: {
          full_name: 'Bob',
          avatar_url: null,
          provider_id: 'apple-sub-1',
          ...overrides,
        },
      },
    },
    error: null,
  });

  describe('POST /auth/google', () => {
    it('creates a user and returns tokens on valid token (new user)', async () => {
      supabase.verifyGoogleToken.mockResolvedValue(googleOk() as any);

      const response = await request(app.getHttpServer())
        .post('/auth/google')
        .send({ token: 'valid.google.token' })
        .expect(200);

      expect(response.body).toMatchObject({
        isNewUser: true,
        expiresIn: 3600,
        user: {
          displayName: 'Alice',
          provider: Provider.GOOGLE,
        },
      });
      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.refreshToken).toEqual(expect.any(String));
      expect(response.body.user).not.toHaveProperty('geohash');
    });

    it('returns isNewUser=false for an existing user', async () => {
      supabase.verifyGoogleToken.mockResolvedValue(googleOk() as any);
      userRepo.seed(
        buildUser({
          id: 'existing-1',
          providerId: 'google-sub-1',
          provider: Provider.GOOGLE,
        }),
      );

      const response = await request(app.getHttpServer())
        .post('/auth/google')
        .send({ token: 'valid.google.token' })
        .expect(200);

      expect(response.body.isNewUser).toBe(false);
      expect(response.body.user.id).toBe('existing-1');
    });

    it('returns 401 when supabase rejects the token', async () => {
      supabase.verifyGoogleToken.mockResolvedValue({
        data: null,
        error: { message: 'invalid jwt' },
      } as any);

      await request(app.getHttpServer())
        .post('/auth/google')
        .send({ token: 'bad.token' })
        .expect(401);
    });

    it('returns 400 when token is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/google')
        .send({})
        .expect(400);
    });
  });

  describe('POST /auth/apple', () => {
    it('creates a user and returns tokens on valid token', async () => {
      supabase.verifyAppleToken.mockResolvedValue(appleOk() as any);

      const response = await request(app.getHttpServer())
        .post('/auth/apple')
        .send({ token: 'valid.apple.token' })
        .expect(200);

      expect(response.body).toMatchObject({
        isNewUser: true,
        user: { provider: Provider.APPLE },
      });
      expect(supabase.verifyAppleToken).toHaveBeenCalledWith(
        'valid.apple.token',
      );
    });

    it('returns 401 when supabase rejects the token', async () => {
      supabase.verifyAppleToken.mockResolvedValue({
        data: null,
        error: { message: 'invalid' },
      } as any);

      await request(app.getHttpServer())
        .post('/auth/apple')
        .send({ token: 'bad' })
        .expect(401);
    });

    it('returns 400 when token is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/apple')
        .send({})
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues a new access token for a valid refresh token', async () => {
      const user = buildUser({ id: 'refresh-user-1' });
      userRepo.seed(user);
      const refreshToken = jwtService.sign(
        { sub: user.id, email: 'alice@example.com' },
        { expiresIn: '30d' },
      );

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toEqual({
        accessToken: expect.any(String),
        expiresIn: 3600,
      });
    });

    it('returns 401 for an invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'not.a.real.jwt' })
        .expect(401);
    });

    it('returns 401 when the user has been deactivated', async () => {
      const user = buildUser({ id: 'inactive-user', isActive: false });
      userRepo.seed(user);
      const refreshToken = jwtService.sign(
        { sub: user.id, email: 'x@example.com' },
        { expiresIn: '30d' },
      );

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('returns 401 when the user does not exist', async () => {
      const refreshToken = jwtService.sign(
        { sub: 'ghost-user', email: 'x@example.com' },
        { expiresIn: '30d' },
      );

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('returns 400 when refreshToken is missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(400);
    });
  });
});
