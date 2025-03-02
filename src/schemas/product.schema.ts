import { z } from 'zod';

export const productSchema = z.object({
    name: z.string({ required_error: 'El nombre es obligatorio' }),
    category: z.string({ required_error: 'La categoría es obligatoria' }),
    price: z.number({ required_error: 'El precio es obligatorio' }),
    tags: z.array(z.string(), { required_error: 'Los tags son obligatorios' }),
    expiration_date: z.string({ required_error: 'La fecha de expiración es obligatoria' })
});