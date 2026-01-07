import { Command } from 'commander';
import config from '../src/config';
import { DlnIndexer } from '../src/indexer/worker'
import { EventTypes } from 'dlni-shared/utils/event-labels';

const indexer = new DlnIndexer(config);
const program = new Command();

program
    .description('Indexer cold start script')
    .argument('<count>', 'Record limits')
    .argument('<type>', `Event type (${Object.values(EventTypes)}))`)
    .action((count, type) => {
        console.log(`Params: count=${count}, type=${type}`);
        indexer.coldStart(count, type);
    });

program.parse(process.argv);
