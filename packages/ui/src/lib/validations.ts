import { z } from "zod";
import { EVENT_TYPE_LABELS } from "./event-labels";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const FilterSchema = z.object({
    range: z.enum(['24h', '3d', '7d', '30d', 'custom']).default('24h'),
    dateFrom: z.string().regex(dateRegex).optional().or(z.string().length(0)),
    dateTo: z.string().regex(dateRegex).optional().or(z.string().length(0)),
    eventName: z.string()
        .default(`${Object.values(EVENT_TYPE_LABELS).join(',')}`) // Дефолт в виде строки
        .transform((val) => val.split(',')) 
        .pipe(z.array(z.enum(Object.values(EVENT_TYPE_LABELS))))
});

export type FilterInput = z.infer<typeof FilterSchema>;