import assert from 'assert';
import * as dotenv from 'dotenv';

dotenv.config();

const env = process.env;

const vars = [
    'DATABASE_URL',
    'INDEXER_RPC_URL',
    'INDEXER_DLN_SOURCE_ADDRESS',
    'INDEXER_DLN_DESTINATION_ADDRESS',
    'INDEXER_PAGE_LIMIT',
];

vars.forEach((key) => {
    assert(env[key], `missing configuration env ${key}`);
});

const all = {
    env: env.NODE_ENV || 'production',
    server: {
        port: parseInt(env.PORT || '3000', 10),
        host: env.HOST || 'localhost',
    },
    lastSignature: {},
    database: {
        url: env.DATABASE_URL,
    },
    logging: {
        level: 'debug',
        timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
    },

    srcContractAddress: env.INDEXER_DLN_SOURCE_ADDRESS,
    dstContractAddress: env.INDEXER_DLN_DESTINATION_ADDRESS,

    indexer: {
        pageLimit: env.INDEXER_PAGE_LIMIT ? +env.INDEXER_PAGE_LIMIT : 1000,
        rpcEndpoint: env.INDEXER_RPC_URL,
        errorDelayMs: 5000,
        idleDelayMs: 5000,
        activeDelayMs: 5000,
    },

    processor: {
        activeDelayMs: 5000,
        errorDelayMs: 5000,
    },
};

const mod = require(`./${all.env}`) || {};

const result = { ...all, ...mod };

export default result as any;
