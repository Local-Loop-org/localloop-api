import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MediaType } from '@localloop/shared-types';

export class SendDirectMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content?: string | null;
}

export interface DirectMessagePayload {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  recipientId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  createdAt: string;
}

export type SendDirectMessageResponseDto =
  | ({ type: 'message' } & DirectMessagePayload)
  | { type: 'request'; requestId: string };
