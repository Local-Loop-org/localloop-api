import {
  AnchorType,
  GroupPrivacy,
  MessagePermission,
} from '@localloop/shared-types';

export class Group {
  constructor(
    public readonly id: string,
    public name: string,
    public description: string | null,
    public anchorType: AnchorType,
    public anchorGeohash: string,
    public anchorLat: number,
    public anchorLng: number,
    public anchorLabel: string | null,
    public privacy: GroupPrivacy,
    public radiusKm: number,
    public readonly ownerId: string,
    public memberCount: number,
    public isActive: boolean,
    public readonly createdAt: Date,
    public sendTextPerm: MessagePermission = MessagePermission.ALL_MEMBERS,
    public sendMediaPerm: MessagePermission = MessagePermission.ALL_MEMBERS,
  ) {}
}
