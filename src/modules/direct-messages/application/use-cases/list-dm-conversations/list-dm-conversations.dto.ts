import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListDmConversationsQueryDto {
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

export interface DmConversationDto {
  peerId: string;
  peerName: string;
  peerAvatarUrl: string | null;
  lastMessage: {
    content: string | null;
    senderName: string;
    createdAt: string;
  };
  unreadCount: number;
  archived: boolean;
}

export interface ListDmConversationsResponseDto {
  data: DmConversationDto[];
  next_cursor: string | null;
}
