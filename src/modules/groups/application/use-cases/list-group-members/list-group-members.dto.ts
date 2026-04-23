import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MemberRole } from '@localloop/shared-types';

export class ListGroupMembersQueryDto {
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

export class GroupMemberDto {
  userId!: string;
  displayName!: string;
  avatarUrl!: string | null;
  role!: MemberRole;
}

export class ListGroupMembersResponseDto {
  data!: GroupMemberDto[];
  next_cursor!: string | null;
}
