import { RequestStatus } from '@localloop/shared-types';

export class GroupJoinRequest {
  constructor(
    public readonly id: string,
    public readonly groupId: string,
    public readonly userId: string,
    public status: RequestStatus,
    public readonly createdAt: Date,
    public resolvedAt: Date | null,
    public resolvedBy: string | null,
  ) {}
}
