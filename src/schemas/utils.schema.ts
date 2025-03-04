import { z } from "zod";

export const utilsSchema = z.object({
    nodeType: z.string()
        .min(1, { message: "El tipo de nodo es obligatorio" })  // No puede estar vacío
        .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, { message: "El nombre del nodo debe ser válido" })  // Validamos nombres de nodos
});