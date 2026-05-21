import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListDmExceptionCandidatesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export interface DmExceptionCandidateDto {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ListDmExceptionCandidatesResponseDto {
  data: DmExceptionCandidateDto[];
  next_cursor: string | null;
}
