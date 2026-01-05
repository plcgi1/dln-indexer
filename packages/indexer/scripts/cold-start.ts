import { Command } from 'commander';
import config from '@config';
import { DlnIndexer } from '@indexer/worker'

const indexer = new DlnIndexer(config);
const program = new Command();

program
    .description('Indexer cold start script')
    .argument('<count>', 'Record limits')
    .argument('<type>', 'Event type (SOURCE/DESTINATION)')
    .action((count, type) => {
        console.log(`Params: count=${count}, type=${type}`);
        indexer.coldStart(count, type);
    });

program.parse(process.argv);

