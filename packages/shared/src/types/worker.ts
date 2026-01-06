export interface IWorker {
    start: () => void;
    stop: () => void;
}

export enum ETaskStatus {
    PENDING = 'PENDING',
    WORKING = 'WORKING',
    READY = 'READY',
    ERROR = 'ERROR',
}
