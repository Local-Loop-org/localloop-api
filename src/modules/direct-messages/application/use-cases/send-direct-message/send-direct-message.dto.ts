import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ChatMessageReplyTo, MediaType } from '@localloop/shared-types';

export class SendDirectMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content?: string | null;

  @IsOptional()
  @IsUUID()
  replyToMessageId?: string;
}

export interface DirectMessagePayload {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  recipientId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  isDeleted: boolean;
  editedAt: string | null;
  replyTo: ChatMessageReplyTo | null;
  createdAt: string;
}

export type SendDirectMessageResponseDto =
  | ({ type: 'message' } & DirectMessagePayload)
  | { type: 'request'; requestId: string };
