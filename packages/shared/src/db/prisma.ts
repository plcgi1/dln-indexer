import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

declare global {
    interface BigInt {
        toJSON(): string;
    }
}

BigInt.prototype.toJSON = function (): string {
    return this.toString();
};

let client: PrismaClient;

export function initPrismaClient(connectionString: string) {
    if (client) {
        return client;
    }
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    client = new PrismaClient({ adapter });
    return client;
}
