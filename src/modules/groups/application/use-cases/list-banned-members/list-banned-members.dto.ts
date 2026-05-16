import {
  GroupMemberDto,
  ListGroupMembersQueryDto,
} from '../list-group-members/list-group-members.dto';

export class ListBannedMembersQueryDto extends ListGroupMembersQueryDto {}

export class ListBannedMembersResponseDto {
  data!: GroupMemberDto[];
  next_cursor!: string | null;
}
