import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from './prisma.service';

const configStub = {
  get: () => 'postgresql://user:pass@localhost:5432/db',
} as unknown as ConfigService<EnvironmentVariables, true>;

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService(configStub);
    jest.spyOn(service, '$connect').mockResolvedValue();
  });

  afterEach(() => jest.restoreAllMocks());

  it('verifies connectivity with a real round-trip on init', async () => {
    const query = jest
      .spyOn(service, '$queryRaw')
      .mockResolvedValue([] as never);

    await service.onModuleInit();

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('fails boot with an actionable message when the database is unreachable', async () => {
    const cause = new Error('ECONNREFUSED');
    jest.spyOn(service, '$queryRaw').mockRejectedValue(cause);

    const init = service.onModuleInit();

    await expect(init).rejects.toThrow('Cannot reach the database');
    await expect(init).rejects.toMatchObject({ cause });
  });

  it('disconnects on shutdown', async () => {
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue();

    await service.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
