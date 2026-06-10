import { AnchorType, GroupPrivacy, MemberRole } from '@localloop/shared-types';

export class GroupDetailDto {
  id!: string;
  name!: string;
  description!: string | null;
  anchorType!: AnchorType;
  anchorLat!: number;
  anchorLng!: number;
  anchorLabel!: string | null;
  privacy!: GroupPrivacy;
  radiusKm!: number;
  memberCount!: number;
  myRole!: MemberRole | null;
  createdAt!: string;
}
