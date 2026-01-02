import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import config from '@config';

const pool = new Pool({ connectionString: config.database.url });
const adapter = new PrismaPg(pool);

declare global {
    interface BigInt {
        toJSON(): string;
    }
}

BigInt.prototype.toJSON = function (): string {
    return this.toString();
};

export const prisma = new PrismaClient({ adapter });
