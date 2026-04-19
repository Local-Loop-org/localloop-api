import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeAppleTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
