import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeGoogleTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
