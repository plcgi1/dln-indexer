import { Connection, PublicKey } from '@solana/web3.js';
import pino from 'pino';
import { ETaskStatus, IWorker } from 'dlni-shared/types/worker';
import { EContractType } from 'dlni-shared/types/contract';
import { delayTimeout } from 'dlni-shared/utils/time';
import { prisma } from '../db';
import { AppConfig } from '../config';
import { Registry, Counter, Gauge } from 'prom-client';
import { EventTypes } from 'dlni-shared/types/event';

export enum ESignaturesPeriod {
  before = 'before',
  until = 'until',
}
// From solita generated code
const createOrderWithNonceInstructionDiscriminator = [130, 131, 98, 190, 40, 206, 68, 50];
// From solita generated code
const fulfillOrderInstructionDiscriminator = [61, 214, 39, 248, 65, 212, 153, 36];
// From solita generated code
const srcDescr = Buffer.from(createOrderWithNonceInstructionDiscriminator).toString('hex');
const dstDescr = Buffer.from(fulfillOrderInstructionDiscriminator).toString('hex');

const DISCRIMINATOR_NAMES: Record<string, string> = {
  [srcDescr]: 'CreateOrderWithNonce',
  [dstDescr]: 'FulfillOrder',
};

export class DlnIndexer implements IWorker {
  private readonly logger: pino.Logger;
  private readonly connection: Connection;
  readonly metrics: {
    txCounter: Counter;
    lastSlotGauge: Gauge;
  };

  private readonly contracts: {
    [EContractType.SOURCE]: {
      pubKey: PublicKey;
    };
    [EContractType.DESTINATION]: {
      pubKey: PublicKey;
    };
  };

  private readonly errorDelayMs: number;
  private readonly idleDelayMs: number;
  private readonly activeDelayMs: number;
  private readonly pageLimit: number;

  constructor(options: AppConfig) {
    this.logger = pino({
      name: DlnIndexer.name,
      ...options.logging,
    });
    const register = new Registry();
    this.metrics = {
      txCounter: new Counter({
        name: 'indexer_tx_saved_total',
        help: 'Total transactions saved to raw database',
        labelNames: ['contract_type'],
        registers: [register],
      }),
      lastSlotGauge: new Gauge({
        name: 'indexer_last_slot',
        help: 'Last processed slot per contract',
        labelNames: ['contract_type'],
        registers: [register],
      }),
    };

    const config = options.indexer;

    this.contracts = {
      [EContractType.SOURCE]: {
        pubKey: new PublicKey(options.srcContractAddress),
      },
      [EContractType.DESTINATION]: {
        pubKey: new PublicKey(options.dstContractAddress),
      },
    };

    this.connection = new Connection(config.rpcEndpoint);

    this.errorDelayMs = config.errorDelayMs;
    this.idleDelayMs = config.idleDelayMs;
    this.activeDelayMs = config.activeDelayMs;
    this.pageLimit = config.pageLimit;
  }

  getEventName(type: EContractType) {
    switch (type) {
      case EContractType.SOURCE:
        return EventTypes.OrderCreated;
      case EContractType.DESTINATION:
        return EventTypes.OrderFulfilled;
      default:
        throw new Error(`Unknown contract type: ${type}`);
    }
  }

  /* We need ordercreated-fullfillorder transactions only - checks if transaction satisfied */
  private isTargetTransaction(tx: any): boolean {
    const instructions = tx.transaction.message.compiledInstructions;

    return instructions.some((ix: any) => {
      // ix.data can be base64 string or buffer - depends from RPC/SDK version
      const data = typeof ix.data === 'string' ? Buffer.from(ix.data, 'base64') : Buffer.from(ix.data);

      if (data.length < 8) return false;

      const discriminator = data.slice(0, 8).toString('hex');

      const result = Object.keys(DISCRIMINATOR_NAMES).includes(discriminator);

      if (result) {
        this.logger.info(
          { discriminator, name: DISCRIMINATOR_NAMES[discriminator] },
          'isTargetTransaction.discriminator found',
        );
      }
      return result;
    });
  }

  /**
   * Gets last saved signature from DB
   */
  private async getCheckpoint(contractType: EContractType): Promise<string | null> {
    const checkpoint = await prisma.syncCheckpoint.findUnique({
      where: { contractType: contractType },
    });

    return checkpoint?.lastSignature || null;
  }

  /**
   * Stores raw transaction and updates checkpoint
   */
  private async saveToDb(signature: string, slot: number, type: EContractType, txData: any) {
    try {
      const eventName = this.getEventName(type);
      await prisma.$transaction(
        async (tx) => {
          const existingTask = await tx.task.findUnique({
            where: { signature: signature },
            select: { id: true, status: true },
          });
          if (existingTask) {
            await tx.task.update({
              where: { id: existingTask.id },
              data: {
                slot: BigInt(slot),
                rawData: txData as any,
                contractType: type,
                eventName,
                blockTimeInt: BigInt(txData.blockTime),
                blockTime: new Date(txData.blockTime * 1000),
              },
            });
            this.logger.info({ signature }, 'Task updated (status preserved)');
          } else {
            await tx.task.create({
              data: {
                signature: signature,
                slot: BigInt(slot),
                contractType: type,
                eventName,
                rawData: txData as any,
                status: ETaskStatus.PENDING,
                blockTimeInt: BigInt(txData.blockTime),
                blockTime: new Date(txData.blockTime * 1000),
              },
            });
            this.logger.info({ signature }, 'New task created (PENDING)');
          }

          // Update SyncCheckpoint
          // we need it to let getCheckpoint know about physical indexer progress
          await tx.syncCheckpoint.upsert({
            where: { contractType: type },
            update: {
              lastSignature: signature,
            },
            create: {
              contractType: type,
              lastSignature: signature,
            },
          });
        },
        {
          // We dont want to block DB with big JSON and set short transaction timeout
          timeout: 10000,
        },
      );
      this.logger.debug({ signature, type }, 'Transaction saved as Task');
    } catch (err: any) {
      this.logger.error(
        {
          err,
          sig: signature,
        },
        'Failed to save task to DB',
      );
      throw err;
    }
  }

  /**
   * One iteration - process one contract (source or destination)
   */
  private async processContract(
    type: EContractType,
    signaturesPeriod: ESignaturesPeriod = ESignaturesPeriod.until,
  ): Promise<number> {
    const pubkey = this.contracts[type].pubKey;
    const lastSig = await this.getCheckpoint(type);

    const signatures = await this.connection.getSignaturesForAddress(pubkey, {
      [signaturesPeriod]: lastSig || undefined,
      limit: this.pageLimit,
    });

    if (signatures.length === 0) return 0;

    this.logger.info({ type, until: lastSig }, 'processContract.Signatures got. Indexing...');

    let saved = 0;
    for (const sigInfo of signatures) {
      try {
        const tx = await this.connection.getTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0,
        });
        // eslint-disable-next-line max-depth
        if (!tx) continue;
        // eslint-disable-next-line max-depth
        if (!this.isTargetTransaction(tx)) {
          this.logger.debug(
            {
              sig: sigInfo.signature,
              type,
            },
            'Skipping transaction: No target instruction found',
          );
          continue;
        }

        await this.saveToDb(sigInfo.signature, sigInfo.slot, type, tx);

        saved++;

        this.metrics.txCounter.inc({ contract_type: type });
        this.metrics.lastSlotGauge.set({ contract_type: type }, sigInfo.slot);

        this.logger.info({ type, signature: sigInfo.signature }, 'processContract.Transaction saved');
      } catch (err: any) {
        this.logger.error({ err: err.message, sig: sigInfo.signature }, 'Failed to process getTransaction');
      }
    }

    return saved;
  }

  /**
   * Main loop - the workhorse
   */
  public async start() {
    this.logger.info('DlnIndexer started');

    while (true) {
      try {
        const sourceCount = await this.processContract(EContractType.SOURCE);
        const destCount = await this.processContract(EContractType.DESTINATION);

        const totalFound = sourceCount + destCount;
        // eslint-disable-next-line max-depth
        if (totalFound === 0) {
          this.logger.debug('No new data. Sleeping...');
          await delayTimeout(this.idleDelayMs);
        } else {
          await delayTimeout(this.activeDelayMs);
          this.logger.debug({ activeDelayMs: this.activeDelayMs }, 'Continue.... Sleeping...');
        }
      } catch (err: any) {
        this.logger.error({ errorDelayMs: this.errorDelayMs, err }, 'Critical error in loop');
        await delayTimeout(this.errorDelayMs);
      }
    }
  }

  /* One time usage - to fetch 25000 records for each (src,dst) contracts */
  public async coldStart(trnLimit: number, type: EContractType) {
    this.logger.info('DlnIndexer cold start started');
    let trnCount = 0;
    while (trnCount < trnLimit) {
      try {
        const savedTasks = await this.processContract(type, ESignaturesPeriod.before);

        trnCount += savedTasks;
        // eslint-disable-next-line max-depth
        if (savedTasks === 0) {
          this.logger.debug('No new data. Sleeping...');
          await delayTimeout(this.idleDelayMs);
        } else {
          await delayTimeout(this.activeDelayMs);
          this.logger.debug({ activeDelayMs: this.activeDelayMs }, 'Continue.... Sleeping...');
        }
      } catch (err: any) {
        this.logger.error({ errorDelayMs: this.errorDelayMs, err }, 'Critical error in loop');
        await delayTimeout(this.errorDelayMs);
      }
    }
  }

  public stop() {
    this.logger.info('Graceful shutdown...');
    prisma.$disconnect();
    process.exit(0);
  }
}
