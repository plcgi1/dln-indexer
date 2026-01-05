import { Connection, PublicKey } from '@solana/web3.js';
import pino from 'pino';
import { Registry, Counter, Gauge } from 'prom-client';
import { ETaskStatus, IWorker } from 'dlni-shared/types/worker';
import { delayTimeout } from 'dlni-shared/utils/time';
import { prisma } from '../db';

export enum EContractType {
    SOURCE = 'SOURCE',
    DESTINATION = 'DESTINATION',
}

const createOrderWithNonceInstructionDiscriminator = [130, 131, 98, 190, 40, 206, 68, 50];

const fulfillOrderInstructionDiscriminator = [61, 214, 39, 248, 65, 212, 153, 36];

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

    constructor(options: any) {
        // TODO пока any - позже конкретизировать
        // @ts-ignore
        this.logger = pino({
            name: DlnIndexer.name,
            ...options.logging,
        });

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

        // Инициализация метрик
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
    }

    private isTargetTransaction(tx: any): boolean {
        // Вытягиваем все инструкции (включая внутренние, если нужно, но обычно проверяем верхнеуровневые)
        const instructions = tx.transaction.message.compiledInstructions;

        return instructions.some((ix: any) => {
            // Защита: ix.data может быть строкой base64 или уже буфером в зависимости от версии RPC/SDK
            const data = typeof ix.data === 'string' ? Buffer.from(ix.data, 'base64') : Buffer.from(ix.data);

            if (data.length < 8) return false;

            const discriminator = data.slice(0, 8).toString('hex');

            // Проверяем наличие текущего дискриминатора в списке разрешенных
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
     * Получает последнюю обработанную сигнатуру из БД
     */
    private async getCheckpoint(contractType: EContractType): Promise<string | null> {
        // 1. Ищем последний READY, чтобы знать, где остановился Процессор
        const lastReady = await prisma.task.findFirst({
            where: {
                contractType: contractType as any,
                status: ETaskStatus.READY,
            },
            orderBy: { slot: 'desc' },
        });

        if (lastReady) return lastReady.signature;

        // 2. Фоллбек на чекпоинт, если READY еще нет (холодный старт)
        const checkpoint = await prisma.syncCheckpoint.findUnique({
            where: { contractType: contractType },
        });

        return checkpoint?.lastSignature || null;
    }

    /**
     * Сохраняет "сырую" транзакцию и обновляет чекпоинт
     */
    private async saveToDb(signature: string, slot: number, type: EContractType, txData: any) {
        try {
            await prisma.$transaction(
                async (tx) => {
                    // 1. Пытаемся найти существующую задачу
                    const existingTask = await tx.task.findUnique({
                        where: { signature: signature },
                        select: { id: true, status: true }, // Берем только нужные поля для скорости
                    });
                    if (existingTask) {
                        // Если задача уже есть, обновляем только "технические" поля.
                        // Мы НЕ передаем поле status в update, чтобы не сбросить READY или WORK.
                        await tx.task.update({
                            where: { id: existingTask.id },
                            data: {
                                slot: BigInt(slot),
                                rawData: txData as any,
                                contractType: type as unknown as EContractType,
                                blockTimeInt: BigInt(txData.blockTime),
                                blockTime: new Date(txData.blockTime * 1000),
                            },
                        });
                        this.logger.info({ signature }, 'Task updated (status preserved)');
                    } else {
                        // Если задачи нет — создаем новую со статусом PENDING
                        await tx.task.create({
                            data: {
                                signature: signature,
                                slot: BigInt(slot),
                                contractType: type as unknown as EContractType,
                                rawData: txData as any,
                                status: ETaskStatus.PENDING,
                                blockTimeInt: BigInt(txData.blockTime),
                                blockTime: new Date(txData.blockTime * 1000),
                            },
                        });
                        this.logger.info({ signature }, 'New task created (PENDING)');
                    }

                    // 2. Обновляем SyncCheckpoint
                    // Это нужно, чтобы getCheckpoint знал о физическом прогрессе индексатора
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
                    // Устанавливаем короткий таймаут для транзакции,
                    // чтобы не блокировать базу при больших JSON
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
            throw err; // Пробрасываем ошибку, чтобы остановить цикл обработки текущей пачки
        }
    }

    /**
     * Логика получения данных для одного контракта
     */
    private async processContract(type: EContractType): Promise<number> {
        const pubkey = this.contracts[type].pubKey;
        const lastSig = await this.getCheckpoint(type);

        const signatures = await this.connection.getSignaturesForAddress(pubkey, {
            before: lastSig || undefined,
            // until: lastSig || undefined,
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

                if (!tx) continue;

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

                this.logger.info({ type, signature: sigInfo.signature }, 'processContract.Transaction saved');

                this.metrics.txCounter.inc({ contract_type: type });
                this.metrics.lastSlotGauge.set({ contract_type: type }, sigInfo.slot);
            } catch (err: any) {
                this.logger.error({ err: err.message, sig: sigInfo.signature }, 'Failed to process getTransaction');
            }
        }

        return saved;
    }

    /**
     * Главный цикл - рабочая лошадка
     */
    public async start() {
        this.logger.info('DlnIndexer started');

        while (true) {
            try {
                const sourceCount = await this.processContract(EContractType.SOURCE);
                const destCount = await this.processContract(EContractType.DESTINATION);

                const totalFound = sourceCount + destCount;

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

    public stop() {
        this.logger.info('Graceful shutdown...');
        prisma.$disconnect();
        process.exit(0);
    }
}
