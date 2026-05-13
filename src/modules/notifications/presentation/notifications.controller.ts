import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Patch,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from '@/modules/auth/domain/entities/user.entity';
import { RegisterCurrentPushDeviceUseCase } from '../application/use-cases/register-current-push-device/register-current-push-device.use-case';
import {
  RegisterCurrentPushDeviceDto,
  RegisterCurrentPushDeviceResponseDto,
} from '../application/use-cases/register-current-push-device/register-current-push-device.dto';
import { DisableCurrentPushDeviceUseCase } from '../application/use-cases/disable-current-push-device/disable-current-push-device.use-case';
import { DisableCurrentPushDeviceQueryDto } from '../application/use-cases/disable-current-push-device/disable-current-push-device.dto';
import { UpdatePushPermissionUseCase } from '../application/use-cases/update-push-permission/update-push-permission.use-case';
import { UpdatePushPermissionDto } from '../application/use-cases/update-push-permission/update-push-permission.dto';

@Controller('users/me')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(
    private readonly registerCurrentDevice: RegisterCurrentPushDeviceUseCase,
    private readonly disableCurrentDevice: DisableCurrentPushDeviceUseCase,
    private readonly updatePushPermission: UpdatePushPermissionUseCase,
  ) {}

  @Put('push-devices/current')
  async registerCurrent(
    @Request() req: { user: User },
    @Body() dto: RegisterCurrentPushDeviceDto,
  ): Promise<RegisterCurrentPushDeviceResponseDto> {
    return this.registerCurrentDevice.execute(req.user.id, dto);
  }

  @Delete('push-devices/current')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disableCurrent(
    @Request() req: { user: User },
    @Query() query: DisableCurrentPushDeviceQueryDto,
  ): Promise<void> {
    await this.disableCurrentDevice.execute(req.user.id, query);
  }

  @Patch('push-permission')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updatePermission(
    @Request() req: { user: User },
    @Body() dto: UpdatePushPermissionDto,
  ): Promise<void> {
    await this.updatePushPermission.execute(req.user.id, dto);
  }
}
