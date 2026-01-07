import assert from 'assert';
import * as dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  env: string;

  database: {
    url: string;
  };
  logging?: {
    level: string;
    timestamp?: () => string;
  };
  srcContractAddress: string;
  dstContractAddress: string;
  indexer: {
    promPort: number;
    pageLimit: number;
    rpcEndpoint: string;
    errorDelayMs: number;
    idleDelayMs: number;
    activeDelayMs: number;
  };
  processor: {
    promPort: number;
    activeDelayMs: number;
    errorDelayMs: number;
  };
  pricer: {
    apiKey: string;
  };
}

const env = process.env;

const vars = [
  'DATABASE_URL',
  'JUPITER_API_KEY',
  'INDEXER_RPC_URL',
  'INDEXER_DLN_SOURCE_ADDRESS',
  'INDEXER_DLN_DESTINATION_ADDRESS',
  'INDEXER_PAGE_LIMIT',
];

vars.forEach((key) => {
  assert(env[key], `missing configuration env ${key}`);
});

const all: AppConfig = {
  env: env.NODE_ENV || 'production',

  database: {
    url: env.DATABASE_URL!,
  },
  logging: {
    level: 'debug',
    timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
  },

  srcContractAddress: env.INDEXER_DLN_SOURCE_ADDRESS!,
  dstContractAddress: env.INDEXER_DLN_DESTINATION_ADDRESS!,

  indexer: {
    promPort: 9091,
    pageLimit: env.INDEXER_PAGE_LIMIT ? +env.INDEXER_PAGE_LIMIT : 100,
    rpcEndpoint: env.INDEXER_RPC_URL!,
    errorDelayMs: 5000,
    idleDelayMs: 5000,
    activeDelayMs: 5000,
  },

  processor: {
    promPort: 9092,
    activeDelayMs: 5000,
    errorDelayMs: 5000,
  },

  pricer: {
    apiKey: env.JUPITER_API_KEY!,
  },
};

const mod = require(`./${all.env}`) || {};

const result = { ...all, ...mod };

export default result as any;
