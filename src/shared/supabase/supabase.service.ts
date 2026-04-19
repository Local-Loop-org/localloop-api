import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    this.client = createClient(
      url || 'https://mock.supabase.co',
      key || 'mock-key',
    );
  }

  async verifyGoogleToken(token: string) {
    // We use the service role key to verify the user's token directly with Supabase
    const { data, error } = await this.client.auth.getUser(token);

    if (error) {
      return { data: null, error };
    }

    return {
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          user_metadata: {
            full_name:
              data.user.user_metadata?.full_name ||
              data.user.user_metadata?.name,
            avatar_url:
              data.user.user_metadata?.avatar_url ||
              data.user.user_metadata?.picture,
            provider_id:
              data.user.identities?.find((i) => i.provider === 'google')?.id ||
              data.user.id,
          },
        },
      },
      error: null,
    };
  }

  async verifyAppleToken(token: string) {
    const { data, error } = await this.client.auth.getUser(token);

    if (error) {
      return { data: null, error };
    }

    return {
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          user_metadata: {
            full_name:
              data.user.user_metadata?.full_name ||
              data.user.user_metadata?.name,
            avatar_url: data.user.user_metadata?.avatar_url,
            provider_id:
              data.user.identities?.find((i) => i.provider === 'apple')?.id ||
              data.user.id,
          },
        },
      },
      error: null,
    };
  }
}
