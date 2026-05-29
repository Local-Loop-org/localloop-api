import { IsString, MaxLength, MinLength } from 'class-validator';

export class EditMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content!: string;
}

export interface EditMessageResponseDto {
  id: string;
  groupId: string;
  content: string;
  editedAt: Date;
  editedBy: string;
}
