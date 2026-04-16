import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IUserRepository, USER_REPOSITORY } from '@/modules/auth/domain/repositories/i-user.repository';
import { User } from '@/modules/auth/domain/entities/user.entity';
import { SupabaseService } from '@/shared/supabase/supabase.service';
import { ExchangeGoogleTokenDto } from './exchange-google-token.dto';
import { AuthResponseDto, UserSummaryDto } from '../auth-response.dto';
import { Provider } from '@localloop/shared-types';

@Injectable()
export class ExchangeGoogleTokenUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async execute(dto: ExchangeGoogleTokenDto): Promise<AuthResponseDto> {
    const { data, error } = await this.supabaseService.verifyGoogleToken(dto.token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid Google token');
    }

    const { id: supabaseId, user_metadata } = data.user;
    const providerId = user_metadata?.provider_id || supabaseId;

    let user = await this.userRepo.findByProvider(providerId, Provider.GOOGLE);
    let isNewUser = false;

    if (!user) {
      user = User.create({
        id: crypto.randomUUID(),
        providerId,
        provider: Provider.GOOGLE,
        displayName: user_metadata?.full_name || 'User',
        avatarUrl: user_metadata?.avatar_url,
      });
      isNewUser = true;
    } else {
      user.displayName = user_metadata?.full_name || user.displayName;
      user.avatarUrl = user_metadata?.avatar_url || user.avatarUrl;
      user.lastSeenAt = new Date();
    }

    await this.userRepo.save(user);

    const payload = { sub: user.id, email: data.user.email };
    
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '30d' }),
      expiresIn: 3600,
      isNewUser,
      user: UserSummaryDto.fromEntity(user),
    };
  }
}
