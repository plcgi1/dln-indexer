import { Task } from '@prisma/client';
import { prisma } from '../common/database/database';
import pino from 'pino';
import { Counter, Gauge } from 'prom-client';
import { ETaskStatus, IWorker } from '@common/types/worker';
import { delayTimeout } from '@common/utils/time';
// import { EContractType } from '@indexer/worker';
// import { EOrderParsingStatus } from '@common/types/order';
// import { keccak256 } from 'js-sha3';
// import { orderBeet } from '@common/generated/src/types/Order';
// import { getAnchorDiscriminator } from '@common/utils/discriminator';
// import { sha256 } from 'js-sha256';
import { DlnTrnDataExtractor } from './data-extractor'
import { EContractType } from '@indexer/worker'

// interface SolanaTransaction {
//     meta: {
//         logMessages: string[] | null;
//         preTokenBalances?: any[];
//         postTokenBalances?: any[];
//     };
// }

// const getEventDisc = (name: string) =>
//     Buffer.from(sha256.digest(`event:${name}`).slice(0, 8)).toString('hex');

// TODO start
//  получить задачи PENDING и src
//  получить задачи PENDING и dst

//  поменять скопом статус на WORKING
//  по каждой задаче
//      получить данные о токене (address, decimal, amountIn, amountOut) из meta.preTokenBalances meta.postTokenBalances
//      получить orderId из meta.logMessages
export class DlnProcessor implements IWorker {
    private readonly logger: pino.Logger;
    public readonly metrics: {
        txCounter: Counter;
        lastSlotGauge: Gauge;
        pendingTasksGauge: Gauge; // Дополнительная метрика для очереди
    };
    private dataExtractor: DlnTrnDataExtractor

    private isRunning = false;

    private readonly errorDelayMs: number;
    private readonly activeDelayMs: number;

    constructor(options: any, dataExtractor: DlnTrnDataExtractor) {
        this.logger = pino({
            name: DlnProcessor.name,
            ...options.logging,
        });
        const config = options.processor;

        // Инициализация метрик
        this.metrics = {
            txCounter: new Counter({
                name: 'processor_processed_tasks_total',
                help: 'Total number of tasks processed by the worker',
                labelNames: ['status', 'type'],
            }),
            lastSlotGauge: new Gauge({
                name: 'processor_last_processed_slot',
                help: 'Last blockchain slot processed by the worker',
                labelNames: ['type'],
            }),
            pendingTasksGauge: new Gauge({
                name: 'processor_pending_tasks_count',
                help: 'Number of tasks currently in PENDING status',
            }),
        };

        this.dataExtractor = dataExtractor

        this.errorDelayMs = config.errorDelayMs;
        this.activeDelayMs = config.activeDelayMs;
    }

    public async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.logger.info('DlnProcessor worker started');

        // while (this.isRunning) {
        //
        // }
        try {
            // Обновляем метрику очереди перед каждым циклом
            const pendingCount = await prisma.task.count({ where: { status: ETaskStatus.PENDING } });
            this.metrics.pendingTasksGauge.set(pendingCount);

            const tasks = await this.claimTasks();

            if (tasks.length === 0) {
                await delayTimeout(this.activeDelayMs);
                // continue;
            }

            for (const task of tasks) {
                await this.processTask(task);
            }
        } catch (err: any) {
            this.logger.error({ err: err.message }, 'Error in processor main loop');
            await delayTimeout(this.errorDelayMs);
        }
    }

    public stop() {
        this.isRunning = false;
        this.logger.info('DlnProcessor worker stopping...');
        process.exit(0);
    }

    private async claimTasks() {
        return await prisma.$transaction(async (tx) => {
            const tasks = await tx.task.findMany({
                where: { status: ETaskStatus.PENDING },
                take: 10,
                orderBy: { slot: 'asc' },
            });
            if (tasks.length > 0) {
                await tx.task.updateMany({
                    where: { id: { in: tasks.map((t) => t.id) } },
                    data: { status: ETaskStatus.WORKING },
                });
            }
            return tasks;
        });
    }

    private async finalizeTask(id: number, status: ETaskStatus, error?: string) {
        await prisma.task.update({
            where: { id },
            data: { status, errorMessage: error },
        });
    }

    // private async upsertOrder(orderId: string, amount: string | null, tokenAddress: string | null, task: Task, tx: any = prisma) {
    //     const isSrc = task.contractType === EContractType.SOURCE;
    //     await tx.order.upsert({
    //         where: { orderId },
    //         update: {
    //             ...(isSrc
    //                 ? {
    //                       srcSignature: task.signature,
    //                       srcSlot: task.slot,
    //                       srcGiveAmount: amount,
    //                       status: EOrderParsingStatus.CREATED,
    //                   }
    //                 : {
    //                       dstSignature: task.signature,
    //                       dstSlot: task.slot,
    //                       status: EOrderParsingStatus.FULFILLED,
    //                   }),
    //         },
    //         create: {
    //             orderId,
    //             srcSignature: isSrc ? task.signature : undefined,
    //             srcSlot: isSrc ? task.slot : undefined,
    //             srcGiveAmount: isSrc ? amount : undefined,
    //             dstSignature: !isSrc ? task.signature : undefined,
    //             dstSlot: !isSrc ? task.slot : undefined,
    //             tokenAddress,
    //             status: isSrc ? EOrderParsingStatus.CREATED : EOrderParsingStatus.FULFILLED,
    //         },
    //     });
    // }
    

    private async processTask(task: Task) {
        try {
            await prisma.$transaction(async (tx) => {
                if(!task.rawData) {
                    return
                }
                const data = this.dataExtractor.extract(task.rawData)
                
                // const txn = task.rawData as unknown as SolanaTransaction;
                // if(!txn.meta) {
                //     return
                // }
                // const meta = txn.meta
                // const logs = txn?.meta?.logMessages;
                //
                // if (!logs) return;
                //
                // console.info('meta', {
                //     status: task.rawData.meta.status,
                //     postBalances: task.rawData.meta.postBalances,
                //     postTokenBalances: task.rawData.meta.postTokenBalances,
                //     rawData: task.rawData,
                //     type: task.contractType
                // })
                // const tokenFlowData = this.extractTokenFlow(meta);
                //
                // const createdDisc = getEventDisc("CreatedOrder");
                // const fulfilledDisc = getEventDisc("OrderFulfilled");
                //
                // for (const log of logs) {
                //     this.handleCreatedOrder(log, createdDisc.toString('hex'), tokenFlowData);
                //     this.handleFulfilledOrder(log, fulfilledDisc.toString('hex'), tokenFlowData);
                // }

                await tx.task.update({
                    where: { id: task.id },
                    data: { status: ETaskStatus.PENDING },
                });
            });

            this.metrics.txCounter.inc({ status: 'success', type: task.contractType });
        } catch (err: any) {
            this.logger.error({ err }, 'Failed to parse deBridge transaction');
            this.metrics.txCounter.inc({ status: 'error', type: task.contractType });
            await this.finalizeTask(task.id, ETaskStatus.ERROR, err.message);
        }
    }

    // private extractTokenFlow(meta: SolanaTransaction['meta']) {
    //     const pre = meta?.preTokenBalances || [];
    //     const post = meta?.postTokenBalances || [];
    //     const indices = new Set([...pre, ...post].map(b => b.accountIndex));
    //
    //     return Array.from(indices).map(idx => {
    //         const b1 = pre.find((b: any) => b.accountIndex === idx);
    //         const b2 = post.find((b: any) => b.accountIndex === idx);
    //         const amountDiff = BigInt(b2?.uiTokenAmount.amount || 0) - BigInt(b1?.uiTokenAmount.amount || 0);
    //
    //         return {
    //             mint: b2?.mint || b1?.mint,
    //             decimals: b2?.uiTokenAmount.decimals ?? b1?.uiTokenAmount.decimals,
    //             amountDiff
    //         };
    //     }).filter(f => f.amountDiff !== 0n);
    // }

    // private handleCreatedOrder(log: string, discriminator: string, flows: any[]) {
    //     if (!log.startsWith("Program data: ")) return;
    //
    //     try {
    //         const buffer = Buffer.from(log.replace("Program data: ", ""), 'base64');
    //         if (buffer.slice(0, 8).toString('hex') !== discriminator) return;
    //
    //         const [order] = orderBeet.deserialize(buffer.slice(8));
    //
    //         // Сериализуем обратно для получения OrderId (кеш keccak256)
    //         // Используем FixableBeet метод для определения размера и записи
    //         const fixedOrderBeet = orderBeet.toFixedFromValue(order);
    //         const serialized = Buffer.alloc(fixedOrderBeet.byteSize);
    //         fixedOrderBeet.write(serialized, 0, order);
    //
    //         const orderId = keccak256(serialized);
    //         const flow = flows.find(f => f.amountDiff < 0n);
    //
    //         console.log("\x1b[32m%s\x1b[0m", ">>> СОБЫТИЕ: CreatedOrder");
    //         console.info(`OrderId: 0x${orderId}`);
    //         console.info(`Token: ${flow?.mint}, Amount: ${flow?.amountDiff}`);
    //     } catch (err) {
    //         console.error("Ошибка в handleCreatedOrder:", err);
    //     }
    // }

    /**
 * Обработка FulfilledOrder (Destination Chain)
 */
    // private handleFulfilledOrder(log: string, discriminator: string, flows: any[]) {
    //     // Проверка 1: Проверяем наличие бинарных данных события
    //     if (log.startsWith("Program data: ")) {
    //         try {
    //             const buffer = Buffer.from(log.replace("Program data: ", ""), 'base64');
    //             // Если это не событие исполнения - выходим
    //             if (buffer.slice(0, 8).toString('hex') !== discriminator) return;
    //
    //             console.log("\x1b[34m%s\x1b[0m", ">>> СОБЫТИЕ: OrderFulfilled (Verified by Disc)");
    //         } catch (err) {
    //             return; // Невалидный base64 или другой дискриминатор
    //         }
    //     }
    //
    //     // Проверка 2: Извлекаем OrderId (он обычно дублируется в логах текстом)
    //     if (!log.includes("Order Id: ")) return;
    //
    //     try {
    //         const rawId = log.split("Order Id: ")[1].trim();
    //         const flow = flows.find(f => f.amountDiff > 0n);
    //         const hexId = rawId.startsWith('0x') ? rawId : '0x' + BigInt(rawId).toString(16);
    //
    //         console.info(`OrderId: ${hexId}`);
    //         console.info(`Received Token: ${flow?.mint}, Amount: ${flow?.amountDiff}`);
    //     } catch (err) {
    //         console.error("Ошибка в handleFulfilledOrder:", err);
    //     }
    // }
}
