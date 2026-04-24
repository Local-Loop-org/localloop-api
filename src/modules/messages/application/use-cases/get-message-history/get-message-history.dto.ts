import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MediaType } from '@localloop/shared-types';

export class GetMessageHistoryQueryDto {
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

export class MessageDto {
  id!: string;
  senderId!: string;
  senderName!: string;
  senderAvatar!: string | null;
  content!: string | null;
  mediaUrl!: string | null;
  mediaType!: MediaType | null;
  createdAt!: string;
}

export class GetMessageHistoryResponseDto {
  data!: MessageDto[];
  next_cursor!: string | null;
}
