import { DlnIndexer } from './worker';
import config from '../config';
import { initPromServer } from 'src/metrics/prom.server';

const indexer = new DlnIndexer(config);

initPromServer(config.indexer.promPort, 'indexer', config);

process.on('SIGINT', () => indexer.stop());
process.on('SIGTERM', () => indexer.stop());

indexer.start().catch((err) => {
  console.error('Fatal start error', err);
  process.exit(1);
});
