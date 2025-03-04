import { Request, Response } from "express";
import fs from "fs";
import { Readable } from "stream";
import { parse } from "fast-csv";
import { Neo4jDriverSingleton } from "../config/neo4j.config";

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
                .on("data", (row: Record<string, string>) => {  
                    records.push(row);
                })
                .on("end", async () => {
                    try {
                        if (fileName.includes("relations")) {
                            await UploadInfoController.importRelationship(session, records);  
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
                .on("error", (error: Error) => {  
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

    static async importRelationship(session: any, records: any[]) {
        for (const record of records) {
            const startId = parseFloat(record.Start_ID);  // Convertimos ID a número
            const endId = parseFloat(record.End_ID);
    
            // 1️⃣ Obtener los nombres de los nodos y la relación
            const startNodeType = record.Start_Node_Type;
            const endNodeType = record.End_Node_Type;
            const relationType = record.Relation;
    
            // 2️⃣ Extraer automáticamente los atributos de la relación
            const excludedKeys = ["Start_Node_Type", "Start_ID", "End_Node_Type", "End_ID", "Relation"];
            const relationProperties = Object.keys(record)
                .filter(key => !excludedKeys.includes(key))
                .map(key => `${key}: $${key}`)
                .join(", ");
    
            // 3️⃣ Buscar nodos exactos por ID
            const startNodeQuery = `MATCH (start:${startNodeType} {ID: $startId}) RETURN start LIMIT 1`;
            const startResult = await session.run(startNodeQuery, { startId });
    
            const endNodeQuery = `MATCH (end:${endNodeType} {ID: $endId}) RETURN end LIMIT 1`;
            const endResult = await session.run(endNodeQuery, { endId });
    
            if (startResult.records.length === 0 || endResult.records.length === 0) {
                console.error(`❌ No se encontraron nodos con los IDs ${startId} o ${endId}`);
                continue;  
            }
    
            // 4️⃣ Construir la consulta `MERGE` de manera dinámica
            const mergeQuery = `
                MATCH (start:${startNodeType} {ID: $startId})
                MATCH (end:${endNodeType} {ID: $endId})
                MERGE (start)-[r:${relationType} { ${relationProperties} }]->(end)
            `;
    
            // 5️⃣ Construir los parámetros dinámicamente
            const parameters: any = { startId, endId };
            for (const key of Object.keys(record)) {
                if (!excludedKeys.includes(key)) {
                    const value = record[key];
    
                    // Convertir tipos automáticamente
                    if (!isNaN(parseFloat(value))) {
                        parameters[key] = parseFloat(value); // Convertir números
                    } else if (value.toLowerCase() === "true" || value.toLowerCase() === "false") {
                        parameters[key] = value.toLowerCase() === "true"; // Convertir booleanos
                    } else {
                        parameters[key] = value; // Mantener strings
                    }
                }
            }
    
            // 6️⃣ Ejecutar la consulta en Neo4j
            await session.run(mergeQuery, parameters);
        }
        console.log(`✅ Se importaron ${records.length} relaciones sin duplicaciones.`);
    }          
}
