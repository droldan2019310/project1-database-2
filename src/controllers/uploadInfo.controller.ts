import { Request, Response } from "express";
import { Neo4jDriverSingleton } from "../config/neo4j.config";
import { parse } from "fast-csv";
import { Readable } from "stream";

export class UploadInfoController {
    static async uploadCSV(req: Request, res: Response): Promise<void> {
        try {
            console.log("📥 Recibiendo archivo...");

            if (!req.file) {
                console.error("❌ No se subió ningún archivo");
                res.status(400).json({ error: "No se subió ningún archivo" });
                return;
            }

            console.log(`📂 Archivo recibido: ${req.file.originalname}`);

            const driver = Neo4jDriverSingleton.getInstance();
            const session = driver.session();
            const records: any[] = [];
            const fileName = req.file.originalname;
            
            // Convertimos el buffer en un stream de lectura
            const stream = Readable.from(req.file.buffer.toString());

            stream
                .pipe(parse({ headers: true }))
                .on("data", (row) => {
                    records.push(row);
                })
                .on("end", async () => {
                    try {
                        if (fileName.includes("relations")) {
                            await UploadInfoController.importRelationships(session, records);
                        } else {
                            await UploadInfoController.importNodes(session, records);
                        }
                        console.log("✅ Archivo procesado con éxito");
                        res.json({ message: `✅ Se importaron ${records.length} registros desde ${fileName}` });
                    } catch (error) {
                        console.error("❌ Error al procesar el archivo:", error);
                        res.status(500).json({ error: "Error al procesar el archivo CSV" });
                    } finally {
                        await session.close();
                    }
                })
                .on("error", (error) => {
                    console.error("❌ Error al leer el archivo CSV:", error);
                    res.status(500).json({ error: "Error al leer el archivo CSV" });
                });
        } catch (error) {
            console.error("❌ Error inesperado:", error);
            res.status(500).json({ error: "Error inesperado al procesar el archivo CSV" });
        }
    }

    static async importNodes(session: any, records: any[]) {
        for (const record of records) {
            const { ID, Type, ...properties } = record;
            const query = `
            CREATE (n:${Type} {ID: $ID, ${Object.keys(properties).map(k => `${k}: $${k}`).join(", ")} })
            RETURN n
            `;

            await session.run(query, { ID: parseInt(ID), ...properties });
        }
    }

    static async importRelationships(session: any, records: any[]) {
        for (const record of records) {
            const { Start_ID, End_ID, Relation, ...properties } = record;
            const query = `
            MATCH (a {ID: $Start_ID}), (b {ID: $End_ID})
            CREATE (a)-[r:${Relation} { ${Object.keys(properties).map(k => `${k}: $${k}`).join(", ")} }]->(b)
            RETURN r
            `;

            await session.run(query, { Start_ID: parseInt(Start_ID), End_ID: parseInt(End_ID), ...properties });
        }
    }
}