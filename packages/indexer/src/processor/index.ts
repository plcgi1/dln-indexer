import { DlnProcessor } from './processor';
import config from '../config';
import { DlnTrnDataExtractor } from './data-extractor';
import { initPromServer } from 'src/metrics/prom.server';

const dataExtractor = new DlnTrnDataExtractor();
const processor = new DlnProcessor(config, dataExtractor);

initPromServer(config.processor.promPort, 'processor', config);

process.on('SIGINT', () => processor.stop());
process.on('SIGTERM', () => processor.stop());

processor.start().catch((err) => {
  console.error('Fatal start error', err);
  process.exit(1);
});
