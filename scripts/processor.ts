import srcRawData from '../raw-data.json'
import dstRawData from '../dst-raw-data.json'
import { DlnTrnDataExtractor } from '../src/processor/data-extractor';
import { TransactionResponse } from '@solana/web3.js';

const extractor = new DlnTrnDataExtractor();

const src = extractor.extract(srcRawData as unknown as TransactionResponse)
const dst = extractor.extract(dstRawData as unknown  as TransactionResponse)

console.info('src', src)
console.info('dst', dst)