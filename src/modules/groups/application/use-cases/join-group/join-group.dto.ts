export type JoinGroupStatus = 'joined' | 'pending';

export class JoinGroupResponseDto {
  status!: JoinGroupStatus;
  role?: 'member';
}
