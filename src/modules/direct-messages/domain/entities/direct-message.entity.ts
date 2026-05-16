import { MediaType } from '@localloop/shared-types';

export class DirectMessage {
  constructor(
    public readonly id: string,
    public readonly senderId: string,
    public readonly recipientId: string,
    public content: string | null,
    public mediaUrl: string | null,
    public mediaType: MediaType | null,
    public isDeleted: boolean,
    public readonly createdAt: Date,
  ) {}
}
