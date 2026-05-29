import { MediaType } from '@localloop/shared-types';

export interface DirectMessageProps {
  id: string;
  senderId: string;
  recipientId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  isDeleted: boolean;
  replyToMessageId: string | null;
  editedAt: Date | null;
  createdAt: Date;
}

export class DirectMessage {
  readonly id: string;
  readonly senderId: string;
  readonly recipientId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  isDeleted: boolean;
  readonly replyToMessageId: string | null;
  editedAt: Date | null;
  readonly createdAt: Date;

  constructor(props: DirectMessageProps) {
    this.id = props.id;
    this.senderId = props.senderId;
    this.recipientId = props.recipientId;
    this.content = props.content;
    this.mediaUrl = props.mediaUrl;
    this.mediaType = props.mediaType;
    this.isDeleted = props.isDeleted;
    this.replyToMessageId = props.replyToMessageId;
    this.editedAt = props.editedAt;
    this.createdAt = props.createdAt;
  }
}
