import { TransactionResponse } from '@solana/web3.js';

export interface DlnTrnDataResponse {
  orderId: string;
  tokenAddress: string;
  decimals: number;
  rawAmount: string;
  amount: string;
}

export class DlnTrnDataExtractor {
  private readonly NATIVE_SOL = 'So11111111111111111111111111111111111111112';

  public extract(tx: TransactionResponse): DlnTrnDataResponse | null {
    const orderId = this.getOrderId(tx);
    const balanceData = this.extractBalanceChange(tx);

    if (!balanceData) return null;

    return {
      orderId: orderId || 'NOT_FOUND',
      tokenAddress: balanceData.mint,
      decimals: balanceData.decimals,
      rawAmount: balanceData.rawAmount,
      amount: this.formatAmount(balanceData.rawAmount, balanceData.decimals),
    };
  }

  private getOrderId(tx: any): string {
    const logs = tx.meta?.logMessages || [];
    // Searching for DST - "Program log: Order Id: 0x..."
    const orderIdLog = logs.find((log: string) => log.match(/Order\s?Id:\s?(0x)?([a-fA-F0-9]{64})/i));
    if (orderIdLog) {
      const orderIdMatch = orderIdLog.match(/Order\s?Id:\s?(0x)?([a-fA-F0-9]{64})/i);
      return orderIdMatch[2].toLowerCase();
    }
    const createOrderIndex = logs.findIndex((log: string) => log.includes('Instruction: CreateOrderWithNonce'));
    if (createOrderIndex === -1) return '';
    const possibleLogs = logs.slice(createOrderIndex + 1);
    const possibleOrderId = possibleLogs.find((log: string) => log.includes('Program data: '));
    if (!possibleOrderId) {
      return '';
    }
    const base64Data = possibleOrderId.slice('Program data: '.length);
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length < 32) return '';
    const orderIdBytes = buffer.subarray(0, 32);
    const result = Buffer.from(orderIdBytes).toString('hex'); // 64-symbol hex string
    return result.toLowerCase();
  }

  /**
   * Analyzes balance changes to find the main token and transaction amount
   */
  private extractBalanceChange(tx: any) {
    const { preTokenBalances, postTokenBalances, preBalances, postBalances } = tx.meta || {};

    if (postTokenBalances?.length > 0) {
      for (const post of postTokenBalances) {
        const pre = preTokenBalances?.find((p: any) => p.accountIndex === post.accountIndex);
        const postAmt = BigInt(post.uiTokenAmount.amount);
        const preAmt = BigInt(pre?.uiTokenAmount.amount || '0');

        const diff = postAmt > preAmt ? postAmt - preAmt : preAmt - postAmt;

        // If balance changed significantly (ignore dust)
        // eslint-disable-next-line max-depth
        if (diff > 0n) {
          return {
            mint: post.mint,
            decimals: post.uiTokenAmount.decimals,
            rawAmount: diff.toString(),
          };
        }
      }
    }

    // If no tokens, check native SOL (lamports)
    // Searching for maximum balance change (except fee)
    for (let i = 0; i < postBalances.length; i++) {
      const diff = BigInt(Math.abs(postBalances[i] - preBalances[i]));
      const fee = BigInt(tx.meta.fee || 0);

      // If change is greater than fee — it's SOL transfer
      if (diff > fee * 10n) {
        return {
          mint: this.NATIVE_SOL,
          decimals: 9,
          rawAmount: (diff - (i === 0 ? fee : 0n)).toString(), // subtract fee if this is the payer
        };
      }
    }
    return null;
  }

  private formatAmount(rawAmount: string, decimals: number): string {
    const amount = BigInt(rawAmount);
    const divisor = BigInt(10 ** decimals);
    const integerPart = amount / divisor;
    const fractionalPart = amount % divisor;
    if (fractionalPart === 0n) return integerPart.toString();
    let fractionStr = fractionalPart.toString().padStart(decimals, '0');
    fractionStr = fractionStr.replace(/0+$/, '');
    return `${integerPart}.${fractionStr}`;
  }
}
