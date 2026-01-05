import { DlnIndexer } from './worker';
import config from '@config';

const indexer = new DlnIndexer(config);

process.on('SIGINT', () => indexer.stop());
process.on('SIGTERM', () => indexer.stop());

indexer.start().catch((err) => {
    console.error('Fatal start error', err);
    process.exit(1);
});
