import { z } from 'zod';

export const branchOfficeSchema = z.object({
    name: z.string({ required_error: 'El nombre es obligatorio' }),
    location: z.string({ required_error: 'La ubicación es obligatoria' }),
    income: z.number({ required_error: 'El ingreso es obligatorio' })
});
