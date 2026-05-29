import { IsString, MaxLength, MinLength } from 'class-validator';

export class EditDirectMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

export interface EditDirectMessageResponseDto {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  editedAt: Date;
  editedBy: string;
}
