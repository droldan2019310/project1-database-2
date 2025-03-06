import { z } from 'zod';

export const buyOrderSchema = z.object({
    id: z.string(),
    status: z.string(),
    total: z.number(),
    items: z.array(z.string()),
    date: z.object({
        year: z.number(),
        month: z.number(),
        day: z.number()
    }),
    voided: z.boolean()
});
