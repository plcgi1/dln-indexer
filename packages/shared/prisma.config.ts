// prisma.config.ts
import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
    datasource: {
        // CLI будет использовать этот URL для миграций и push
        url: process.env.DATABASE_URL,
    },
});