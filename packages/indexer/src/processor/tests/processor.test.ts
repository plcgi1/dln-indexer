// packages/indexer/src/processor/tests/processor.test.ts
import { DlnProcessor } from '../processor';
import { ETaskStatus } from 'dlni-shared/types/worker';
import { register } from 'prom-client';

jest.mock('../../db', () => {
  const { mockDeep } = require('jest-mock-extended');
  return { __esModule: true, prisma: mockDeep() };
});

import { prisma as mockPrisma } from '../../db';
import { AppConfig } from '../../config';
import { PublicKey } from '@solana/web3.js';

describe('DlnProcessor', () => {
  let processor: DlnProcessor;
  const mockExtractor: any = { extract: jest.fn() };
  const mockOptions: AppConfig = {
    env: 'test',
    logging: { level: 'silent' },
    database: {
      url: 'DATABASE_URL',
    },
    indexer: {
      promPort: 9091,
      rpcEndpoint: 'http://localhost:8899',
      errorDelayMs: 1000,
      idleDelayMs: 1000,
      activeDelayMs: 1000,
      pageLimit: 10,
    },
    srcContractAddress: PublicKey.unique().toBase58(),
    dstContractAddress: PublicKey.unique().toBase58(),
    processor: {
      promPort: 9091,
      activeDelayMs: 5000,
      errorDelayMs: 5000,
    },

    pricer: {
      apiKey: 'JUPITER_API_KEY',
      ttlCacheMs: 15 * 60 * 1000,
    },
  };

  beforeEach(() => {
    processor = new DlnProcessor(mockOptions, mockExtractor);
    register.clear();
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (cb) => cb(mockPrisma));
  });

  it('should claim tasks and change their status to WORKING', async () => {
    const mockTasks = [{ id: 1, status: ETaskStatus.PENDING }];
    (mockPrisma.processCheckpoint.findFirst as jest.Mock).mockResolvedValue({ lastTaskId: 0 });
    (mockPrisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

    const tasks = await (processor as any).claimTasks();

    expect(tasks).toHaveLength(1);
    expect(mockPrisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: ETaskStatus.WORKING },
      }),
    );
  });

  it('should finalize task with error if data is empty', async () => {
    const mockTask: any = { id: 1, rawData: {}, signature: 'sig' };
    mockExtractor.extract.mockReturnValue(null); // Эмуляция пустого результата

    await (processor as any).processTask(mockTask);

    expect(mockPrisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: ETaskStatus.ERROR }),
      }),
    );
  });
});
