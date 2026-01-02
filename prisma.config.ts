import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';

// Явно загружаем .env файл
dotenv.config();

export default defineConfig({
    datasource: {
        url: process.env.DATABASE_URL,
    },
});