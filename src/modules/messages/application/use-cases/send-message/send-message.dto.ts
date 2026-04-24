import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MediaType } from '@localloop/shared-types';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content?: string | null;
}

export class SendMessageResponseDto {
  id!: string;
  groupId!: string;
  senderId!: string;
  senderName!: string;
  senderAvatar!: string | null;
  content!: string | null;
  mediaUrl!: string | null;
  mediaType!: MediaType | null;
  createdAt!: string;
}
