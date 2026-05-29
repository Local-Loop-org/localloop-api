import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ChatMessageReplyTo, MediaType } from '@localloop/shared-types';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content?: string | null;

  @IsOptional()
  @IsUUID()
  replyToMessageId?: string;

  // Opaque echo token sourced from the mobile temp-id format
  // (temp-<epoch>-<random6>). Not @IsUUID() because the value is
  // shaped by the client, not the server.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  clientMessageId?: string;
}

export class SendMessageResponseDto {
  id!: string;
  clientMessageId!: string | null;
  groupId!: string;
  senderId!: string;
  senderName!: string;
  senderAvatarUrl!: string | null;
  content!: string | null;
  mediaUrl!: string | null;
  mediaType!: MediaType | null;
  isDeleted!: boolean;
  editedAt!: string | null;
  replyTo!: ChatMessageReplyTo | null;
  createdAt!: string;
}
