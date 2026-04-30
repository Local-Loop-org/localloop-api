import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AnchorType, MemberRole } from '@localloop/shared-types';

export class ListMyGroupsQueryDto {
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

export class LastMessageSummaryDto {
  content!: string | null;
  senderName!: string;
  createdAt!: string;
}

export class MyGroupDto {
  id!: string;
  name!: string;
  anchorType!: AnchorType;
  anchorLabel!: string;
  memberCount!: number;
  myRole!: MemberRole;
  lastActivityAt!: string;
  lastMessage!: LastMessageSummaryDto | null;
}

export class ListMyGroupsResponseDto {
  data!: MyGroupDto[];
  next_cursor!: string | null;
}
