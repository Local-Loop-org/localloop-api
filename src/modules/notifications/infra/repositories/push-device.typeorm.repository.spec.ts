import {
  MemberStatus,
  PushPermissionStatus,
  PushProvider,
} from '@localloop/shared-types';
import { Repository } from 'typeorm';
import { UserEntity } from '@/modules/auth/infra/repositories/user.entity';
import { GroupMemberOrmEntity } from '@/modules/groups/infra/repositories/group-member.entity';
import { PushDeviceTypeORMRepository } from './push-device.typeorm.repository';
import { PushDeviceOrmEntity } from './push-device.entity';

describe('PushDeviceTypeORMRepository', () => {
  let repo: jest.Mocked<Repository<PushDeviceOrmEntity>>;
  let repository: PushDeviceTypeORMRepository;

  beforeEach(() => {
    repo = {
      createQueryBuilder: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<PushDeviceOrmEntity>>;
    repository = new PushDeviceTypeORMRepository(repo);
  });

  it('lists enabled devices for active group members with granted push permission', async () => {
    const qb = buildQueryBuilderMock([
      {
        user_id: 'user-2',
        provider: PushProvider.EXPO,
        token: 'ExponentPushToken[one]',
      },
    ]);
    repo.createQueryBuilder.mockReturnValue(qb as never);

    const rows = await repository.listEnabledGroupMemberDevices('group-1', [
      'user-1',
    ]);

    expect(repo.createQueryBuilder).toHaveBeenCalledWith('d');
    expect(qb.innerJoin).toHaveBeenCalledWith(
      GroupMemberOrmEntity,
      'gm',
      'gm.user_id = d.user_id AND gm.group_id = :groupId',
      { groupId: 'group-1' },
    );
    expect(qb.innerJoin).toHaveBeenCalledWith(
      UserEntity,
      'u',
      'u.id = d.user_id',
    );
    expect(qb.where).toHaveBeenCalledWith('d.enabled = :enabled', {
      enabled: true,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('gm.status = :memberStatus', {
      memberStatus: MemberStatus.ACTIVE,
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'u.push_permission_status = :permissionStatus',
      { permissionStatus: PushPermissionStatus.GRANTED },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'd.user_id NOT IN (:...excludedUserIds)',
      { excludedUserIds: ['user-1'] },
    );
    expect(rows).toEqual([
      {
        userId: 'user-2',
        provider: PushProvider.EXPO,
        token: 'ExponentPushToken[one]',
      },
    ]);
  });

  it('disables all enabled rows matching a provider token', async () => {
    await repository.disableByProviderToken(
      PushProvider.EXPO,
      'ExponentPushToken[bad]',
    );

    expect(repo.update).toHaveBeenCalledWith(
      {
        provider: PushProvider.EXPO,
        token: 'ExponentPushToken[bad]',
        enabled: true,
      },
      { enabled: false, disabledAt: expect.any(Date) },
    );
  });
});

interface QueryBuilderMock {
  innerJoin: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  select: jest.Mock;
  getRawMany: jest.Mock;
}

function buildQueryBuilderMock(rows: unknown[]): QueryBuilderMock {
  const qb = {} as QueryBuilderMock;
  qb.innerJoin = jest.fn(() => qb);
  qb.where = jest.fn(() => qb);
  qb.andWhere = jest.fn(() => qb);
  qb.select = jest.fn(() => qb);
  qb.getRawMany = jest.fn(async () => rows);
  return qb;
}
