import { IsIn } from 'class-validator';

export type JoinRequestAction = 'approve' | 'reject';

export class ResolveJoinRequestDto {
  @IsIn(['approve', 'reject'])
  action!: JoinRequestAction;
}

export class ResolveJoinRequestResponseDto {
  status!: 'approved' | 'rejected';
}
