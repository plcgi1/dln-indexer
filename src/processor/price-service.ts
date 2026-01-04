import config from '@config';
import { prisma } from '../common/database/database';
import pino from 'pino';
import Big from 'big.js';

export interface TokenPrice {
  usdPrice: number;
  blockId: number;
  decimals: number;
  priceChange24h?: number;
}

export type PriceResponse = Record<string, TokenPrice>;

export class PriceService {
  private readonly JUPITER_API = 'https://api.jup.ag/price/v3';
  private readonly HELIUS_API_KEY = config.pricer.apiKey;
  private readonly CACHE_TTL_MS = 15 * 60 * 1000;
  private readonly logger: pino.Logger = pino({ name: 'PriceService' });

  async getPrice(tokenAddress: string, decimals: number): Promise<Big> {
    const cached = await prisma.tokenPrice.findUnique({ where: { tokenAddress } });

    if (cached && Date.now() - cached.updatedAt.getTime() < this.CACHE_TTL_MS) {
      return new Big(cached.priceUsd.toString());
    }

    return await this.fetchAndSavePrice(tokenAddress, decimals);
  }
  /**
   * Получает точную цену токена через fetch с API-ключом
   */
  private async fetchAndSavePrice(tokenAddress: string, decimals: number): Promise<Big> {
    try {
      const response = await fetch(`${this.JUPITER_API}?ids=${tokenAddress}`, {
        headers: { 'x-api-key': this.HELIUS_API_KEY },
      });

      const data = (await response.json()) as PriceResponse;

      const rawPrice = data[tokenAddress].usdPrice;

      if (!rawPrice) {
        this.logger.warn(`[PriceService] Токен ${tokenAddress} не найден в Jupiter V3`);
        return new Big(0);
      }

      const price = new Big(rawPrice);
      await prisma.tokenPrice.upsert({
        where: { tokenAddress },
        update: {
          priceUsd: price.toString(),
          updatedAt: new Date(),
        },
        create: {
          tokenAddress,
          priceUsd: price.toString(),
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
   * Точный расчет объема сделки
   */
  calculateVolume(amountRaw: string | bigint, decimals: number, priceUsd: Big): string {
    if (priceUsd.eq(0)) return '0';

    const amount = new Big(amountRaw.toString());
    const divisor = new Big(10).pow(decimals);

    // Точный расчет: (amount / 10^decimals) * price
    const result = amount.div(divisor).mul(priceUsd).toFixed(8); // 6 знаков после запятой для достаточной точности USD
    return result;
  }
}
