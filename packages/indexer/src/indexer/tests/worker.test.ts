import { DlnIndexer } from '../worker';
import { PublicKey } from '@solana/web3.js';

jest.mock('../../db', () => {
  const { mockDeep } = require('jest-mock-extended');
  return {
    __esModule: true,
    prisma: mockDeep(),
  };
});

import { prisma as mockPrisma } from '../../db';
import { mockReset } from 'jest-mock-extended';
import { AppConfig } from '../../config';
import { EContractType } from 'dlni-shared/types/contract';
import { EventTypes } from 'dlni-shared/utils/event-labels';

describe('DlnIndexer', () => {
  let indexer: DlnIndexer;
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
    },
  };

  beforeEach(() => {
    mockReset(mockPrisma as any);
    indexer = new DlnIndexer(mockOptions);
  });

  describe('isTargetTransaction', () => {
    it('should return true for CreateOrderWithNonce discriminator', () => {
      const mockTx = {
        transaction: {
          message: {
            compiledInstructions: [
              {
                // Descriminator [130, 131, 98, 190, 40, 206, 68, 50] в hex
                data: Buffer.from([130, 131, 98, 190, 40, 206, 68, 50, 1, 2, 3]),
              },
            ],
          },
        },
      };
      expect((indexer as any).isTargetTransaction(mockTx)).toBe(true);
    });

    it('should return false for unknown discriminator', () => {
      const mockTx = {
        transaction: {
          message: {
            compiledInstructions: [{ data: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]) }],
          },
        },
      };
      expect((indexer as any).isTargetTransaction(mockTx)).toBe(false);
    });
  });

  describe('saveToDb', () => {
    it('should create a new task if it does not exist', async () => {
      const signature = 'test_sig';
      const slot = 12345;
      const txData = { blockTime: 1600000000 };

      (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      });

      await (indexer as any).saveToDb(signature, slot, EContractType.SOURCE, txData);

      expect(mockPrisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            signature: signature,
            status: 'PENDING',
            contractType: EContractType.SOURCE,
            eventName: EventTypes.OrderCreated,
          }),
        }),
      );
    });

    it('should update task if it already exists but keep status', async () => {
      const signature = 'existing_sig';
      (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue({ id: 1, status: 'WORK' });

      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return await callback(mockPrisma);
      });

      await (indexer as any).saveToDb(signature, 100, EContractType.SOURCE, { blockTime: 123 });

      expect(mockPrisma.task.update).toHaveBeenCalled();

      const updateCall = (mockPrisma.task.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.status).toBeUndefined();
    });
  });

  describe('getCheckpoint', () => {
    it('should return lastSignature from DB', async () => {
      (mockPrisma.syncCheckpoint.findUnique as jest.Mock).mockResolvedValue({
        lastSignature: 'sig_123',
      });

      const result = await (indexer as any).getCheckpoint(EContractType.SOURCE);
      expect(result).toBe('sig_123');
    });
  });
});
