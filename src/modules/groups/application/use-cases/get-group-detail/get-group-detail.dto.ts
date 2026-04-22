import { AnchorType, GroupPrivacy, MemberRole } from '@localloop/shared-types';

export class GroupDetailDto {
  id!: string;
  name!: string;
  description!: string | null;
  anchorType!: AnchorType;
  anchorLabel!: string;
  privacy!: GroupPrivacy;
  memberCount!: number;
  myRole!: MemberRole | null;
}
