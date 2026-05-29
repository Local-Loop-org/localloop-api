import { MediaType } from '@localloop/shared-types';

export interface MessageProps {
  id: string;
  groupId: string;
  senderId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  isDeleted: boolean;
  replyToMessageId: string | null;
  editedAt: Date | null;
  createdAt: Date;
}

export class Message {
  readonly id: string;
  readonly groupId: string;
  readonly senderId: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  isDeleted: boolean;
  readonly replyToMessageId: string | null;
  editedAt: Date | null;
  readonly createdAt: Date;

  constructor(props: MessageProps) {
    this.id = props.id;
    this.groupId = props.groupId;
    this.senderId = props.senderId;
    this.content = props.content;
    this.mediaUrl = props.mediaUrl;
    this.mediaType = props.mediaType;
    this.isDeleted = props.isDeleted;
    this.replyToMessageId = props.replyToMessageId;
    this.editedAt = props.editedAt;
    this.createdAt = props.createdAt;
  }
}
