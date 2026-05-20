import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MediaType } from '@localloop/shared-types';

export class GetDirectMessageHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  before?: string;
}

export class DirectMessageDto {
  id!: string;
  senderId!: string;
  senderName!: string;
  senderAvatarUrl!: string | null;
  recipientId!: string;
  content!: string | null;
  mediaUrl!: string | null;
  mediaType!: MediaType | null;
  createdAt!: string;
}

export class GetDirectMessageHistoryResponseDto {
  data!: DirectMessageDto[];
  next_cursor!: string | null;
}
