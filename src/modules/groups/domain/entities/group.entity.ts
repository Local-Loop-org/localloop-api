import { AnchorType, GroupPrivacy } from '@localloop/shared-types';

export class Group {
  constructor(
    public readonly id: string,
    public name: string,
    public description: string | null,
    public anchorType: AnchorType,
    public anchorGeohash: string,
    public anchorLat: number,
    public anchorLng: number,
    public anchorLabel: string,
    public privacy: GroupPrivacy,
    public readonly ownerId: string,
    public memberCount: number,
    public isActive: boolean,
    public readonly createdAt: Date,
  ) {}
}
