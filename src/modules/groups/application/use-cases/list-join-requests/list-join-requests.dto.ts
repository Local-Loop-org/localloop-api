export class JoinRequestDto {
  id!: string;
  userId!: string;
  displayName!: string;
  createdAt!: string;
}

export class ListJoinRequestsResponseDto {
  data!: JoinRequestDto[];
}
