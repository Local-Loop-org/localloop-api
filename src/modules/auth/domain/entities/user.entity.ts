import { Provider, DmPermission } from '@localloop/shared-types';

export class User {
  constructor(
    public readonly id: string,
    public readonly providerId: string,
    public readonly provider: Provider,
    public displayName: string,
    public avatarUrl: string | null,
    public geohash: string | null,
    public dmPermission: DmPermission,
    public isActive: boolean,
    public lastSeenAt: Date,
    public createdAt: Date,
  ) {}

  static create(props: {
    id: string;
    providerId: string;
    provider: Provider;
    displayName: string;
    avatarUrl?: string | null;
  }): User {
    return new User(
      props.id,
      props.providerId,
      props.provider,
      props.displayName,
      props.avatarUrl ?? null,
      null,
      DmPermission.MEMBERS,
      true,
      new Date(),
      new Date(),
    );
  }
}
