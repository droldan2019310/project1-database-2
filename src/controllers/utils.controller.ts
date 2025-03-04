import { Request, Response } from "express";
import { z } from "zod";
import { Neo4jDriverSingleton } from "../config/neo4j.config";
import { utilsSchema } from "../schemas/utils.schema";

export class UtilsController {
    public static countNodes = async (req: Request, res: Response): Promise<void> => {
        try {
            const validatedParams = utilsSchema.parse(req.params);
            const { nodeType } = validatedParams;

            const driver = Neo4jDriverSingleton.getInstance();
            const session = driver.session();

            const result = await session.run(
                `MATCH (n:${nodeType}) RETURN count(n) AS total`
            );

            const totalNodes = result.records[0]?.get("total") || 0;
            res.json({ nodeType, totalNodes }); // ✅ Usamos `res.json` directamente

        } catch (error) {
            if (error instanceof z.ZodError) {
                res.status(400).json({ errors: error.errors });
                return;
            }
            console.error("❌ Error al contar nodos:", error);
            res.status(500).json({ error: "Error al contar nodos en Neo4j" });
        }
    };
}