import { Counter, Gauge } from 'prom-client';

export interface IWorker {
  readonly metrics: {
    txCounter: Counter;
    lastSlotGauge: Gauge;
  };
  start: () => void;
  stop: () => void;
}

export enum ETaskStatus {
  PENDING = 'PENDING',
  WORKING = 'WORKING',
  READY = 'READY',
  ERROR = 'ERROR',
}
