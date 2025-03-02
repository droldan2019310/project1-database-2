import { z } from "zod";

export const invoiceSchema = z.object({
    id: z.number().int().positive(),
    name: z.string().min(3, "El nombre es obligatorio"),
    nit: z.string().min(8, "El NIT es obligatorio"),
    total: z.number().positive(),
    cashier_main: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha incorrecto (YYYY-MM-DD)"),
    status: z.string(),
    notes: z.string().optional()
});