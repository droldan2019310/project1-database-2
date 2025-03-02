import { z } from 'zod';

export const routeSchema = z.object({
    quantity: z.number({ required_error: 'La cantidad es obligatoria' }),
    delivery_name: z.string({ required_error: 'El nombre del repartidor es obligatorio' }),
    arrive_date: z.string({ required_error: 'La fecha de llegada es obligatoria' }),
    arrive_hour: z.string({ required_error: 'La hora de llegada es obligatoria' })
});