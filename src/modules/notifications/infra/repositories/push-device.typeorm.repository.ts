import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MemberStatus,
  PushPermissionStatus,
  PushProvider,
} from '@localloop/shared-types';
import { UserEntity } from '@/modules/auth/infra/repositories/user.entity';
import { GroupMemberOrmEntity } from '@/modules/groups/infra/repositories/group-member.entity';
import {
  IPushDeviceRepository,
  PushRecipientDevice,
  UpsertPushDeviceData,
} from '../../domain/repositories/i-push-device.repository';
import { PushDevice } from '../../domain/entities/push-device.entity';
import { PushDeviceMapper } from '../mappers/push-device.mapper';
import { PushDeviceOrmEntity } from './push-device.entity';

@Injectable()
export class PushDeviceTypeORMRepository implements IPushDeviceRepository {
  constructor(
    @InjectRepository(PushDeviceOrmEntity)
    private readonly repo: Repository<PushDeviceOrmEntity>,
  ) {}

  async upsertCurrentDevice(data: UpsertPushDeviceData): Promise<PushDevice> {
    await this.repo.upsert(
      {
        userId: data.userId,
        installationId: data.installationId,
        provider: data.provider,
        platform: data.platform,
        token: data.token,
        enabled: true,
        lastSeenAt: new Date(),
        disabledAt: null,
      },
      {
        conflictPaths: ['userId', 'installationId', 'provider'],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    const saved = await this.repo.findOneByOrFail({
      userId: data.userId,
      installationId: data.installationId,
      provider: data.provider,
    });
    return PushDeviceMapper.toDomain(saved);
  }

  async listEnabledGroupMemberDevices(
    groupId: string,
    excludedUserIds: string[],
  ): Promise<PushRecipientDevice[]> {
    const qb = this.repo
      .createQueryBuilder('d')
      .innerJoin(
        GroupMemberOrmEntity,
        'gm',
        'gm.user_id = d.user_id AND gm.group_id = :groupId',
        { groupId },
      )
      .innerJoin(UserEntity, 'u', 'u.id = d.user_id')
      .where('d.enabled = :enabled', { enabled: true })
      .andWhere('gm.status = :memberStatus', {
        memberStatus: MemberStatus.ACTIVE,
      })
      .andWhere('u.push_permission_status = :permissionStatus', {
        permissionStatus: PushPermissionStatus.GRANTED,
      });

    if (excludedUserIds.length > 0) {
      qb.andWhere('d.user_id NOT IN (:...excludedUserIds)', {
        excludedUserIds,
      });
    }

    const rows = await qb
      .select([
        'd.user_id AS user_id',
        'd.provider AS provider',
        'd.token AS token',
      ])
      .getRawMany<{
        user_id: string;
        provider: PushProvider;
        token: string;
      }>();

    return rows.map((row) => ({
      userId: row.user_id,
      provider: row.provider,
      token: row.token,
    }));
  }

  async disableCurrentDevice(
    userId: string,
    installationId: string,
    provider: PushProvider,
  ): Promise<void> {
    await this.repo.update(
      { userId, installationId, provider },
      { enabled: false, disabledAt: new Date() },
    );
  }

  async disableAllForUser(userId: string): Promise<void> {
    await this.repo.update(
      { userId, enabled: true },
      { enabled: false, disabledAt: new Date() },
    );
  }

  async disableByProviderToken(
    provider: PushProvider,
    token: string,
  ): Promise<void> {
    await this.repo.update(
      { provider, token, enabled: true },
      { enabled: false, disabledAt: new Date() },
    );
  }
}
