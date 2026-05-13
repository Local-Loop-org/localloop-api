import { PushDevice } from '../../domain/entities/push-device.entity';
import { PushDeviceOrmEntity } from '../repositories/push-device.entity';

export class PushDeviceMapper {
  static toDomain(entity: PushDeviceOrmEntity): PushDevice {
    return new PushDevice(
      entity.id,
      entity.userId,
      entity.installationId,
      entity.provider,
      entity.platform,
      entity.token,
      entity.enabled,
      entity.lastSeenAt,
      entity.createdAt,
      entity.disabledAt,
    );
  }
}
