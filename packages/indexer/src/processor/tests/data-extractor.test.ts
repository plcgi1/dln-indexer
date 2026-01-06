// packages/indexer/src/processor/tests/data-extractor.test.ts
import { DlnTrnDataExtractor } from '../data-extractor';

describe('DlnTrnDataExtractor', () => {
  let extractor: DlnTrnDataExtractor;

  beforeEach(() => {
    extractor = new DlnTrnDataExtractor();
  });

  it('should extract Order ID from DST transaction logs', () => {
    const mockTx: any = {
      meta: {
        logMessages: [
          'Program log: Instruction: FulfillOrder',
          'Program log: Order Id: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        ],
        postTokenBalances: [],
        preBalances: [1000000000],
        postBalances: [900000000],
        fee: 5000,
      },
    };

    const result = (extractor as any).getOrderId(mockTx);
    expect(result).toBe('1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
  });

  it('should calculate native SOL balance change correctly', () => {
    const mockTx: any = {
      meta: {
        preBalances: [2000000000, 500000000],
        postBalances: [1000000000, 500000000],
        fee: 5000,
      },
    };
    const result = (extractor as any).extractBalanceChange(mockTx);
    expect(result.mint).toBe('So11111111111111111111111111111111111111112');
    // 2.0 SOL - 1.0 SOL - fee (0.000005) = 0.999995
    expect(result.rawAmount).toBe('999995000');
  });
});
