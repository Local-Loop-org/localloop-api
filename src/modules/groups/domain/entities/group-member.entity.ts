import { MemberRole, MemberStatus } from '@localloop/shared-types';

export class GroupMember {
  constructor(
    public readonly id: string,
    public readonly groupId: string,
    public readonly userId: string,
    public role: MemberRole,
    public status: MemberStatus,
    public readonly joinedAt: Date,
  ) {}
}
