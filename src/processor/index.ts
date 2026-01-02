import { DlnProcessor } from './processor';
import config from '@config';
import { DlnTrnDataExtractor } from './data-extractor'

const dataExtractor = new DlnTrnDataExtractor()
const processor = new DlnProcessor(config, dataExtractor);

process.on('SIGINT', () => processor.stop());
process.on('SIGTERM', () => processor.stop());

processor.start().catch((err) => {
    console.error('Fatal start error', err);
    process.exit(1);
});
