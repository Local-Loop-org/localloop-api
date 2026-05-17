export interface LastMessageSummary {
  content: string | null;
  senderName: string;
  createdAt: Date;
}

export interface PaginatedResult<T, C = string> {
  rows: T[];
  nextCursor: C | null;
}
