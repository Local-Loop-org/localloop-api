import { coordinatesToGeohash } from '@localloop/geo-utils';
import { IUserRepository } from '@/modules/auth/domain/repositories/i-user.repository';
import { UpdateUserLocationUseCase } from './update-user-location.use-case';

describe('UpdateUserLocationUseCase', () => {
  let useCase: UpdateUserLocationUseCase;
  let userRepo: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    userRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByProvider: jest.fn(),
      updateLastSeen: jest.fn(),
      updateGeohash: jest.fn(),
    };

    useCase = new UpdateUserLocationUseCase(userRepo);
  });

  it('converts coordinates to a geohash and stores it against the user', async () => {
    const lat = -23.5505;
    const lng = -46.6333;
    const expectedGeohash = coordinatesToGeohash(lat, lng);

    await useCase.execute('user-1', { lat, lng });

    expect(userRepo.updateGeohash).toHaveBeenCalledTimes(1);
    expect(userRepo.updateGeohash).toHaveBeenCalledWith(
      'user-1',
      expectedGeohash,
    );
  });

  it('stores different geohashes for distant coordinates', async () => {
    await useCase.execute('user-1', { lat: -23.5505, lng: -46.6333 });
    await useCase.execute('user-1', { lat: 40.7128, lng: -74.006 });

    const firstGeohash = (
      userRepo.updateGeohash.mock.calls[0] as [string, string]
    )[1];
    const secondGeohash = (
      userRepo.updateGeohash.mock.calls[1] as [string, string]
    )[1];
    expect(firstGeohash).not.toEqual(secondGeohash);
  });

  it('accepts boundary coordinates without throwing', async () => {
    await expect(
      useCase.execute('user-1', { lat: -90, lng: 180 }),
    ).resolves.toBeUndefined();
    expect(userRepo.updateGeohash).toHaveBeenCalledTimes(1);
  });
});
