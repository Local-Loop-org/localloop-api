import {
  AnchorType,
  GroupPrivacy,
  MemberRole,
  MemberStatus,
  RequestStatus,
} from '@localloop/shared-types';
import { Brackets, DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { GroupTypeORMRepository } from './group.typeorm.repository';
import { GroupOrmEntity } from './group.entity';
import { GroupMemberOrmEntity } from './group-member.entity';
import { GroupJoinRequestOrmEntity } from './group-join-request.entity';

interface FindNearbyRawRow {
  gm_role: MemberRole | null;
  gm_status: MemberStatus | null;
  gjr_status: RequestStatus | null;
}

interface FindNearbyQueryBuilderMock {
  leftJoin: jest.MockedFunction<
    (
      entity: typeof GroupMemberOrmEntity | typeof GroupJoinRequestOrmEntity,
      alias: string,
      condition: string,
      params?: Record<string, unknown>,
    ) => FindNearbyQueryBuilderMock
  >;
  addSelect: jest.MockedFunction<
    (selection: string, alias: string) => FindNearbyQueryBuilderMock
  >;
  where: jest.MockedFunction<(condition: string) => FindNearbyQueryBuilderMock>;
  andWhere: jest.MockedFunction<
    (
      condition: string | Brackets,
      params?: Record<string, unknown>,
    ) => FindNearbyQueryBuilderMock
  >;
  getRawAndEntities: jest.MockedFunction<
    () => Promise<{ entities: GroupOrmEntity[]; raw: FindNearbyRawRow[] }>
  >;
}

function buildGroup(): GroupOrmEntity {
  return Object.assign(new GroupOrmEntity(), {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Centro',
    description: null,
    anchorType: AnchorType.NEIGHBORHOOD,
    anchorGeohash: '6gyf4b',
    anchorLat: -23.5505,
    anchorLng: -46.6333,
    anchorLabel: 'Centro',
    privacy: GroupPrivacy.APPROVAL_REQUIRED,
    radiusKm: 5,
    ownerId: '22222222-2222-2222-2222-222222222222',
    memberCount: 1,
    isActive: true,
    createdAt: new Date('2026-05-15T00:00:00.000Z'),
  });
}

function buildQueryBuilder(result: {
  entities: GroupOrmEntity[];
  raw: FindNearbyRawRow[];
}): FindNearbyQueryBuilderMock {
  const qb = {} as FindNearbyQueryBuilderMock;
  qb.leftJoin = jest.fn(
    (
      _entity: typeof GroupMemberOrmEntity | typeof GroupJoinRequestOrmEntity,
      _alias: string,
      _condition: string,
      _params?: Record<string, unknown>,
    ) => qb,
  ) as FindNearbyQueryBuilderMock['leftJoin'];
  qb.addSelect = jest.fn(
    (_selection: string, _alias: string) => qb,
  ) as FindNearbyQueryBuilderMock['addSelect'];
  qb.where = jest.fn(
    (_condition: string) => qb,
  ) as FindNearbyQueryBuilderMock['where'];
  qb.andWhere = jest.fn(
    (_condition: string | Brackets, _params?: Record<string, unknown>) => qb,
  ) as FindNearbyQueryBuilderMock['andWhere'];
  qb.getRawAndEntities = jest
    .fn()
    .mockResolvedValue(
      result,
    ) as FindNearbyQueryBuilderMock['getRawAndEntities'];
  return qb;
}

function buildRepository(
  qb: FindNearbyQueryBuilderMock,
): GroupTypeORMRepository {
  const groupsRepo = {
    createQueryBuilder: jest.fn(
      () => qb as unknown as SelectQueryBuilder<GroupOrmEntity>,
    ),
  } as unknown as Repository<GroupOrmEntity>;

  return new GroupTypeORMRepository(
    {} as DataSource,
    groupsRepo,
    {} as Repository<GroupMemberOrmEntity>,
    {} as Repository<GroupJoinRequestOrmEntity>,
  );
}

describe('GroupTypeORMRepository', () => {
  describe('findNearby', () => {
    it('maps a pending join request to pending member status when no member row exists', async () => {
      const userId = '33333333-3333-3333-3333-333333333333';
      const qb = buildQueryBuilder({
        entities: [buildGroup()],
        raw: [
          {
            gm_role: null,
            gm_status: null,
            gjr_status: RequestStatus.PENDING,
          },
        ],
      });
      const repository = buildRepository(qb);

      const result = await repository.findNearby(userId, ['6gyf4b']);

      expect(qb.leftJoin).toHaveBeenCalledWith(
        GroupJoinRequestOrmEntity,
        'gjr',
        'gjr.group_id = g.id AND gjr.user_id = :userId AND gjr.status = :pendingRequest',
        { userId, pendingRequest: RequestStatus.PENDING },
      );
      expect(qb.addSelect).toHaveBeenCalledWith('gjr.status', 'gjr_status');
      expect(result[0].myRole).toBeNull();
      expect(result[0].memberStatus).toBe(MemberStatus.PENDING);
    });
  });
});
