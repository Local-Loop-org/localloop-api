import { MediaType } from '@localloop/shared-types';

export class Message {
  constructor(
    public readonly id: string,
    public readonly groupId: string,
    public readonly senderId: string,
    public content: string | null,
    public mediaUrl: string | null,
    public mediaType: MediaType | null,
    public isDeleted: boolean,
    public readonly createdAt: Date,
  ) {}
}
