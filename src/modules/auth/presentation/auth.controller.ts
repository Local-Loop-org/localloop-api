import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ExchangeGoogleTokenUseCase } from '../application/use-cases/exchange-google-token/exchange-google-token.use-case';
import { ExchangeAppleTokenUseCase } from '../application/use-cases/exchange-apple-token/exchange-apple-token.use-case';
import { ExchangeGoogleTokenDto } from '../application/use-cases/exchange-google-token/exchange-google-token.dto';
import { ExchangeAppleTokenDto } from '../application/use-cases/exchange-apple-token/exchange-apple-token.dto';
import { AuthResponseDto } from '../application/use-cases/auth-response.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly exchangeGoogleToken: ExchangeGoogleTokenUseCase,
    private readonly exchangeAppleToken: ExchangeAppleTokenUseCase,
  ) {}

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() dto: ExchangeGoogleTokenDto): Promise<AuthResponseDto> {
    return this.exchangeGoogleToken.execute(dto);
  }

  @Post('apple')
  @HttpCode(HttpStatus.OK)
  async appleLogin(@Body() dto: ExchangeAppleTokenDto): Promise<AuthResponseDto> {
    return this.exchangeAppleToken.execute(dto);
  }
}
