import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListDmExceptionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export interface DmExceptionDto {
  peerId: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface ListDmExceptionsResponseDto {
  data: DmExceptionDto[];
  next_cursor: string | null;
}
