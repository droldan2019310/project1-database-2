import { z } from 'zod';

export const routeSchema = z.object({
    quantity: z.number(),
    delivery_name: z.string(),
    arrive_date: z.string(),
    arrive_hour: z.string(),
    company: z.string(),
    distance_km: z.number()
});
