import { Idl, Solita } from '@metaplex-foundation/solita';
import { IDLSrc } from '../abi/src'
import { IDLDst } from '../abi/dst'
import * as fs from 'fs/promises';
import path from 'path';
import config from '@config';

async function run() {
    const configs = [
        {
            name: 'src',
            idl: IDLSrc,
            programId: config.srcContractAddress,
        },
        {
            name: 'dst',
            idl: IDLDst,
            programId: config.dstContractAddress,
        }
    ];

    for (const conf of configs) {
        console.log(`🚀 Генерация SDK для: ${conf.name}`);

        const idl = { 
            ...conf.idl, 
            metadata: {
                address: conf.programId, origin: 'anchor' 
            }
        }  as any as Idl;
     
        // 2. Создаем экземпляр Solita
        const solita = new Solita(idl, {
            formatCode: true, // Автоматическое форматирование (prettier)
            projectRoot: path.join(__dirname, '../../'),
        });

        // ВАЖНО: Напрямую вызываем рендеринг в нужную директорию
        const outputDir = path.join(__dirname, '../generated', conf.name);

        // Очищаем старую папку перед генерацией (рекомендуется)
        await fs.rm(outputDir, { recursive: true, force: true });

        // Запуск генерации
        await solita.renderAndWriteTo(outputDir);

        console.log(`✅ SDK для ${conf.name} успешно создан в ${outputDir}`);
    }
}

run().catch(console.error);