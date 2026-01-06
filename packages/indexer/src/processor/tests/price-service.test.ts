// packages/indexer/src/processor/tests/price-service.test.ts
import { PriceService } from '../price-service';
import Big from 'big.js';

jest.mock('../../db', () => {
  const { mockDeep } = require('jest-mock-extended');
  return { __esModule: true, prisma: mockDeep() };
});

import { prisma as mockPrisma } from '../../db';

describe('PriceService', () => {
  let priceService: PriceService;

  beforeEach(() => {
    priceService = new PriceService();
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('should return cached price if it is not expired', async () => {
    const mockToken = 'TokenAddress123';
    (mockPrisma.tokenPrice.findUnique as jest.Mock).mockResolvedValue({
      tokenAddress: mockToken,
      usdPrice: '1.5',
      updatedAt: new Date(), // Текущее время (не просрочено)
    });

    const price = await priceService.getPrice(mockToken, 6);
    expect(price.toString()).toBe('1.5');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('should correctly calculate volume using Big.js', () => {
    const amount = '1000000'; // 1.0 при decimals 6
    const decimals = 6;
    const price = new Big('2.5');

    const volume = priceService.calculateVolume(amount, decimals, price);
    expect(volume).toBe('2.500000000');
  });
});
