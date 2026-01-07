import config from '../config';
import { prisma } from '../db';
import pino from 'pino';
import Big from 'big.js';

export interface TokenPrice {
  usdPrice: number;
  blockId: number;
  decimals: number;
  priceChange24h?: number;
  liquidity?: number;
}

export type PriceApiResponse = Record<string, TokenPrice>;

export class PriceService {
  private readonly JUPITER_API = 'https://api.jup.ag/price/v3';
  private readonly JUPITER_API_KEY = config.pricer.apiKey;
  private readonly CACHE_TTL_MS = config.pricer.ttlCacheMs;
  private readonly logger: pino.Logger = pino({ name: 'PriceService' });

  async getPrice(tokenAddress: string, decimals: number): Promise<Big> {
    const cached = await prisma.tokenPrice.findUnique({ where: { tokenAddress } });

    if (cached && cached.usdPrice && Date.now() - cached.updatedAt.getTime() < this.CACHE_TTL_MS) {
      return new Big(cached.usdPrice.toString());
    }

    return await this.fetchAndSavePrice(tokenAddress, decimals);
  }

  /**
   * Fetches the exact price of a token via fetch with API key and saves it to the database
   */
  private async fetchAndSavePrice(tokenAddress: string, decimals: number): Promise<Big> {
    const url = `${this.JUPITER_API}?ids=${tokenAddress}`;

    try {
      const response = await fetch(url, {
        headers: { 'x-api-key': this.JUPITER_API_KEY },
      });

      const data = (await response.json()) as PriceApiResponse;

      const rawPrice = data[tokenAddress].usdPrice;

      if (!rawPrice) {
        this.logger.warn({ url }, `[PriceService] Токен ${tokenAddress} не найден в Jupiter V3`);
        return new Big(0);
      }

      const price = new Big(rawPrice);

      await prisma.tokenPrice.upsert({
        where: { tokenAddress },
        update: {
          usdPrice: price.toString(),
          updatedAt: new Date(),
        },
        create: {
          tokenAddress,
          usdPrice: price.toString(),
          decimals,
        },
      });

      return price;
    } catch (error) {
      this.logger.error({ error }, `[PriceService] Fetch failed for ${tokenAddress}:`);
      return new Big(0);
    }
  }

  /**
   * Exact calculation of the trade volume in USD using Big.js
   */
  calculateVolume(amountRaw: string | bigint, decimals: number, priceUsd: Big): string {
    if (priceUsd.eq(0)) return '0';

    const amount = new Big(amountRaw.toString());
    const divisor = new Big(10).pow(decimals);

    // (amount / 10^decimals) * price
    const result = amount.div(divisor).mul(priceUsd).toFixed(9);
    return result;
  }
}
