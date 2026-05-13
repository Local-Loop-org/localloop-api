import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushProvider } from '@localloop/shared-types';
import {
  IPushDeviceRepository,
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
}
