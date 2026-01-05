import { z } from "zod";

export const FilterSchema = z.object({
    range: z.enum(['24h', '3d', '7d', '30d', 'custom']).default('24h'),
    dateFrom: z.string().datetime().optional().or(z.string().length(0)), // ISO дата или пустая строка
    dateTo: z.string().datetime().optional().or(z.string().length(0)),
    types: z.string()
        .default('SOURCE,DESTINATION') // Дефолт в виде строки
        .transform((val) => val.split(',')) // Превращаем в ["SOURCE", "DESTINATION"]
        .pipe(z.array(z.enum(['SOURCE', 'DESTINATION']))), // Проверяем элементы массива
});

export type FilterInput = z.infer<typeof FilterSchema>;