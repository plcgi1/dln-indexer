import config from '../config';
import { initPrismaClient } from 'dlni-shared/db/prisma';

export const prisma = initPrismaClient(config.database.url);
