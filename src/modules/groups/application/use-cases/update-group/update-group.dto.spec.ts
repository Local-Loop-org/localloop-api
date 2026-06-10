import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateGroupDto } from './update-group.dto';

describe('UpdateGroupDto', () => {
  const validateDto = (body: Record<string, unknown>) =>
    validate(plainToInstance(UpdateGroupDto, body));

  it('accepts a valid coordinate pair', async () => {
    const errors = await validateDto({ lat: -25.4284, lng: -49.2733 });

    expect(errors).toHaveLength(0);
  });

  it('accepts updates without coordinates', async () => {
    const errors = await validateDto({ name: 'New name' });

    expect(errors).toHaveLength(0);
  });

  it('accepts a null anchor label', async () => {
    const errors = await validateDto({ anchorLabel: null });

    expect(errors).toHaveLength(0);
  });

  it('rejects lat without lng', async () => {
    const errors = await validateDto({ lat: -25.4284 });

    expect(errors.map((error) => error.property)).toContain('lng');
  });

  it('rejects lng without lat', async () => {
    const errors = await validateDto({ lng: -49.2733 });

    expect(errors.map((error) => error.property)).toContain('lat');
  });

  it('rejects coordinates outside latitude and longitude ranges', async () => {
    const errors = await validateDto({ lat: -91, lng: -181 });

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['lat', 'lng']),
    );
  });
});
