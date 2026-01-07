export interface IWorker {
    start: () => void;
    stop: () => void;
}

export const ETaskStatus = {
    PENDING: 'PENDING',
    WORKING: 'WORKING',
    READY: 'READY',
    ERROR: 'ERROR',
} as const;

// Создаем тип из объекта для использования в коде
export type ETaskStatus = typeof ETaskStatus[keyof typeof ETaskStatus];
