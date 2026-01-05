import * as dotenv from 'dotenv';
import { initPrismaClient } from 'dlni-shared/db/prisma';

dotenv.config();

export const prisma = initPrismaClient(process.env.DATABASE_URL!);
