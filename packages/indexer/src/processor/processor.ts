import { Task } from '@prisma/client';
import { prisma } from '../db';
import pino from 'pino';
import { Counter, Gauge } from 'prom-client';
import { ETaskStatus, IWorker } from 'dlni-shared/types/worker';
import { delayTimeout } from 'dlni-shared/utils/time';
import { DlnTrnDataExtractor } from './data-extractor';
import { TransactionResponse } from '@solana/web3.js';
import { PriceService } from './price-service';
import { AppConfig } from '../config';

export class DlnProcessor implements IWorker {
  private readonly logger: pino.Logger;

  private dataExtractor: DlnTrnDataExtractor;
  private priceService: PriceService = new PriceService();
  private isRunning = false;
  private limitTasks = 10;
  private readonly errorDelayMs: number;
  private readonly activeDelayMs: number;
  private workingTasks: number[] = [];
  public readonly metrics: {
    txCounter: Counter;
    lastSlotGauge: Gauge;
    pendingTasksGauge: Gauge; // Дополнительная метрика для очереди
  };

  constructor(options: AppConfig, dataExtractor: DlnTrnDataExtractor) {
    this.logger = pino({
      name: DlnProcessor.name,
      ...options.logging,
    });
    this.metrics = {
      txCounter: new Counter({
        name: 'processor_processed_tasks_total',
        help: 'Total number of tasks processed by the processor',
        labelNames: ['status', 'type'],
      }),
      lastSlotGauge: new Gauge({
        name: 'processor_last_processed_slot',
        help: 'Last task id processed by the processor',
        labelNames: ['task'],
      }),
      pendingTasksGauge: new Gauge({
        name: 'processor_pending_tasks_count',
        help: 'Number of tasks currently in PENDING status',
      }),
    };

    const config = options.processor;
    this.dataExtractor = dataExtractor;

    this.errorDelayMs = config.errorDelayMs;
    this.activeDelayMs = config.activeDelayMs;
  }

  public async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.info('DlnProcessor worker started');

    while (this.isRunning) {
      try {
        // Обновляем метрику очереди перед каждым циклом
        const pendingCount = await prisma.task.count({
          where: { status: ETaskStatus.PENDING },
        });
        this.logger.info({ pendingCount }, 'Pending tasks count');
        this.metrics.pendingTasksGauge.set(pendingCount);

        const tasks = await this.claimTasks();

        this.logger.info({ count: tasks.length }, 'Start tasks');
        // eslint-disable-next-line max-depth
        if (tasks.length === 0) {
          await delayTimeout(this.activeDelayMs);
          continue;
        }
        this.workingTasks = tasks.map((t) => t.id);
        // eslint-disable-next-line max-depth
        for (const task of tasks) {
          await this.processTask(task);
        }
      } catch (err: any) {
        this.logger.error({ err }, 'Error in processor main loop');
        await delayTimeout(this.errorDelayMs);
      }
    }
  }

  public async stop() {
    this.isRunning = false;

    await prisma.task.updateMany({
      where: { status: ETaskStatus.WORKING, id: { in: this.workingTasks } },
      data: { status: ETaskStatus.PENDING },
    });

    this.logger.info({ workingTasks: this.workingTasks }, 'DlnProcessor worker stopping...');

    prisma.$disconnect();

    process.exit(0);
  }

  private async getCheckpoint(tx: any): Promise<number | null> {
    const checkpoint = await tx.processCheckpoint.findFirst({});

    return checkpoint?.lastTaskId || null;
  }

  private async updateCheckpoint(taskId: number, tx: any): Promise<void> {
    await tx.processCheckpoint.upsert({
      where: { id: 1 },
      update: {
        lastTaskId: taskId,
      },
      create: {
        lastTaskId: taskId,
      },
    });
  }

  private async claimTasks() {
    return await prisma.$transaction(async (tx) => {
      const checkpoint = await this.getCheckpoint(tx);

      const where: Record<string, any> = { status: ETaskStatus.PENDING };
      if (checkpoint) {
        where.id = {
          gte: checkpoint,
        };
      }
      const tasks = await tx.task.findMany({
        where,
        take: this.limitTasks,
        orderBy: { id: 'asc' },
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

  private async upsertTrnLog(
    orderId: string,
    amount: string | null,
    tokenAddress: string | null,
    decimals: number | null,
    price: string | null,
    usdValue: string | null,
    task: Task,
    tx: any = prisma,
  ) {
    await tx.trnLog.upsert({
      where: {
        orderId_trnEventType: {
          orderId: orderId,
          trnEventType: task.contractType, // Обязательно указываем тип
        },
      },
      update: {
        amount,
        tokenAddress,
        decimals,
        trnDate: task.blockTime,
        usdValue,
        usdPrice: price,
      },
      create: {
        orderId,
        tokenAddress,
        amount,
        decimals,
        trnDate: task.blockTime,
        signature: task.signature,
        trnEventType: task.contractType,
        eventName: task.eventName,
        usdValue,
        usdPrice: price,
      },
    });
  }

  private async processTask(task: Task) {
    try {
      await prisma.$transaction(async (tx) => {
        if (!task.rawData) {
          return;
        }
        const trnData = task.rawData as unknown as TransactionResponse;

        const data = this.dataExtractor.extract(trnData);

        if (data === null) {
          this.logger.warn({ signature: task.signature, data }, 'Empty transaction data');
          await tx.task.update({
            where: { id: task.id },
            data: {
              status: ETaskStatus.ERROR,
              errorMessage: 'Empty transaction data',
            },
          });
          return;
        }
        const price = await this.priceService.getPrice(data.tokenAddress, data.decimals);

        if (price.eq(0)) {
          this.logger.warn(
            { signature: task.signature },
            `Price for token ${data.tokenAddress} is zero, skipping order ${data.orderId}`,
          );
        }
        const usdValue = this.priceService.calculateVolume(data.amount, data.decimals, price);
        await this.upsertTrnLog(
          data.orderId,
          data.amount,
          data.tokenAddress,
          data.decimals,
          price.toFixed(18),
          usdValue,
          task,
          tx,
        );

        await this.updateCheckpoint(task.id, tx);

        this.metrics.lastSlotGauge.set({ task: task.id }, task.id);

        await tx.task.update({
          where: { id: task.id },
          data: { status: ETaskStatus.READY },
        });
        this.metrics.txCounter.inc({ status: 'success', type: task.contractType });
      });
    } catch (err: any) {
      this.logger.error({ err }, 'Failed to parse deBridge transaction');
      this.metrics.txCounter.inc({ status: 'error', type: task.contractType });
      await this.finalizeTask(task.id, ETaskStatus.ERROR, err.message);
    }
  }
}
