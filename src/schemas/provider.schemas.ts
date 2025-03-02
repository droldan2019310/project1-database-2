import { z } from "zod";

export const providerSchema = z.object({
    id: z.number().int().positive(),
    name: z.string().min(3, "El nombre es obligatorio"),
    location: z.string().min(3, "Ubicación obligatoria")
});