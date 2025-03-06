import { Request, Response } from "express";
import { Neo4jDriverSingleton } from "../config/neo4j.config";
import { providerSchema } from "../schemas/provider.schemas";
import { z } from "zod";

// Crear proveedor
export const createProvider = async (req: Request, res: Response): Promise<void> => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const validatedData = providerSchema.parse(req.body);
        const { id, name, location } = validatedData;

        const query = `
        CREATE (p:Provider {
            ID: $id,
            Name: $name,
            Location: $location,
            Voided: false
        })
        RETURN elementId(p) AS id, p
        `;

        const result = await session.run(query, validatedData);
        res.status(201).json({ id: result.records[0].get("id"), ...result.records[0].get("p").properties });

    } catch (error) {
        res.status(400).json({ message: "Error al crear proveedor", error });
    } finally {
        await session.close();
    }
};

// Obtener todos los proveedores activos
export const getProviders = async (req: Request, res: Response): Promise<void> => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        let { page, limit } = req.query;

        const pageNumber = parseInt(page as string, 10) || 1;
        const limitNumber = parseInt(limit as string, 10) || 10;

        if (isNaN(pageNumber) || pageNumber < 1) {
            res.status(400).json({ message: "El parámetro 'page' debe ser un número entero mayor a 0" });
            return;
        }

        if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
            res.status(400).json({ message: "El parámetro 'limit' debe ser un número entre 1 y 100" });
            return;
        }

        const offset = (pageNumber - 1) * limitNumber;

        // 🔍 Query para obtener proveedores y sus relaciones
        const query = `
            MATCH (p:Provider)
            WHERE p.Voided = false
            
            OPTIONAL MATCH (p)-[r1:PROVIDES_TO]->(b:BranchOffice)
            OPTIONAL MATCH (p)-[r2:USE]->(route:Route)
            OPTIONAL MATCH (p)-[r3:RECEIVES]->(order:Buy_Order)

            RETURN 
                toString(elementId(p)) AS providerId, 
                p,
                
                // BranchOffice
                collect(CASE WHEN b IS NOT NULL THEN {
                    id: toString(elementId(b)),
                    ID: b.ID,
                    Name: b.Name,
                    Location: b.Location,
                    Income: b.Income,
                    Voided: b.Voided,
                    relationshipType: type(r1)
                } ELSE null END) AS branchOffices,

                // Route
                collect(CASE WHEN route IS NOT NULL THEN {
                    id: toString(elementId(route)),
                    ID: route.ID,
                    Name: route.Name,
                    Distance_KM: route.Distance_KM,
                    Company: route.Company,
                    Start_date: route.Start_date,
                    End_date: route.End_date,
                    Voided: route.Voided,
                    relationshipType: type(r2)
                } ELSE null END) AS routes,

                // BuyOrder
                collect(CASE WHEN order IS NOT NULL THEN {
                    id: toString(elementId(order)),
                    ID: order.ID,
                    Date: order.Date,
                    Total: order.Total,
                    Status: order.Status,
                    Items: order.Items,
                    Voided: order.Voided,
                    relationshipType: type(r3)
                } ELSE null END) AS buyOrders

            ORDER BY p.Name ASC
            SKIP ${offset} LIMIT ${limitNumber}
        `;

        const result = await session.run(query);

        const providers = result.records.map(record => {
            const provider = record.get('p').properties;

            return {
                id: record.get('providerId'),
                ...provider,
                branchOffices: (record.get('branchOffices') || []).filter((bo: any) => bo !== null),
                routes: (record.get('routes') || []).filter((r: any) => r !== null),
                buyOrders: (record.get('buyOrders') || []).filter((bo: any) => bo !== null),
            };
        });

        // 📊 Query para contar todos los proveedores
        const countResult = await session.run(`
            MATCH (p:Provider)
            WHERE p.Voided = false
            RETURN count(p) AS total
        `);
        const totalProviders = countResult.records[0]?.get("total").toNumber() || 0;

        res.json({
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(totalProviders / limitNumber),
            totalProviders,
            providers
        });

    } catch (error) {
        console.error("❌ Error al obtener proveedores:", error);
        res.status(500).json({ message: "Error al obtener proveedores", error });
    } finally {
        await session.close();
    }
};


export const searchProviderByName = async (req: Request, res: Response): Promise<void> => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const { name } = req.params;

        if (!name) {
            res.status(400).json({ message: "El parámetro 'name' es obligatorio" });
            return;
        }

        // 🔍 Query para buscar proveedores por nombre parcial (case insensitive)
        const query = `
            MATCH (p:Provider)
            WHERE p.Voided = false AND toLower(p.Name) CONTAINS toLower($name)
            
            OPTIONAL MATCH (p)-[r1:PROVIDES_TO]->(b:BranchOffice)
            OPTIONAL MATCH (p)-[r2:USE]->(route:Route)
            OPTIONAL MATCH (p)-[r3:RECEIVES]->(order:Buy_Order)

            RETURN 
                toString(elementId(p)) AS providerId, 
                p,
                
                // BranchOffice
                collect(CASE WHEN b IS NOT NULL THEN {
                    id: toString(elementId(b)),
                    ID: b.ID,
                    Name: b.Name,
                    Location: b.Location,
                    Income: b.Income,
                    Voided: b.Voided,
                    relationshipType: type(r1)
                } ELSE null END) AS branchOffices,

                // Route
                collect(CASE WHEN route IS NOT NULL THEN {
                    id: toString(elementId(route)),
                    ID: route.ID,
                    Name: route.Name,
                    Distance_KM: route.Distance_KM,
                    Company: route.Company,
                    Start_date: route.Start_date,
                    End_date: route.End_date,
                    Voided: route.Voided,
                    relationshipType: type(r2)
                } ELSE null END) AS routes,

                // BuyOrder
                collect(CASE WHEN order IS NOT NULL THEN {
                    id: toString(elementId(order)),
                    ID: order.ID,
                    Date: order.Date,
                    Total: order.Total,
                    Status: order.Status,
                    Items: order.Items,
                    Voided: order.Voided,
                    relationshipType: type(r3)
                } ELSE null END) AS buyOrders
        `;

        const result = await session.run(query, { name });

        const providers = result.records.map(record => {
            const provider = record.get('p').properties;

            return {
                id: record.get('providerId'),
                ...provider,
                branchOffices: (record.get('branchOffices') || []).filter((bo: any) => bo !== null),
                routes: (record.get('routes') || []).filter((r: any) => r !== null),
                buyOrders: (record.get('buyOrders') || []).filter((bo: any) => bo !== null),
            };
        });

        res.json({
            count: providers.length,
            providers
        });

    } catch (error) {
        console.error("❌ Error al buscar proveedor por nombre:", error);
        res.status(500).json({ message: "Error al buscar proveedor", error });
    } finally {
        await session.close();
    }
};



// Soft delete (marcar proveedor como inactivo)
export const softDeleteProvider = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const result = await session.run(`MATCH (p:Provider) WHERE elementId(p) = $id SET p.Voided = true RETURN p`, { id });
        if (result.records.length === 0) {
            res.status(404).json({ message: "Proveedor no encontrado" });
            return;
        }
        res.json({ message: "Proveedor marcado como inactivo" });

    } catch (error) {
        res.status(500).json({ message: "Error al eliminar proveedor", error });
    } finally {
        await session.close();
    }
};

// Actualizar un proveedor
export const updateProvider = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const validatedData = providerSchema.parse(req.body);
        const { name, location } = validatedData;

        const query = `
        MATCH (p:Provider)
        WHERE elementId(p) = $id
        SET p.Name = $name,
            p.Location = $location
        RETURN elementId(p) AS id, p
        `;

        const result = await session.run(query, { id, name, location });

        if (result.records.length === 0) {
            res.status(404).json({ message: "Proveedor no encontrado" });
            return;
        }

        res.json({ id: result.records[0].get("id"), ...result.records[0].get("p").properties });

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Error de validación",
                errors: error.errors.map(e => ({ campo: e.path.join("."), mensaje: e.message }))
            });
        } else {
            res.status(500).json({ message: "Error al actualizar proveedor", error });
        }
    } finally {
        await session.close();
    }
};

// Obtener proveedores con más ventas
export const getTopProvidersBySales = async (_req: Request, res: Response): Promise<void> => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const result = await session.run(`
            MATCH (p:Provider)-[:PROVIDES_TO]->(b:BranchOffice)
            RETURN p.Name AS Provider, COUNT(b) AS Sales
            ORDER BY Sales DESC
            LIMIT 5
        `);

        res.json(result.records.map(record => ({
            provider: record.get("Provider"),
            sales: record.get("Sales")
        })));

    } catch (error) {
        res.status(500).json({ message: "Error al obtener proveedores", error });
    } finally {
        await session.close();
    }
};




export const createProviderRelationship = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const {
            sourceId,
            targetId,
            sourceType,
            targetType,
            quantity_of_orders_in_time,
            type_product,
            range_client,
            cost_of_operation,
            status_payment,
            type_vehicle
        } = req.body;

        console.log("📥 Request Body:", req.body);

        if (!sourceId || !targetId || !sourceType || !targetType) {
            res.status(400).json({ message: "Faltan parámetros obligatorios." });
            return;
        }

        const relationshipType = getProviderRelationshipType(sourceType, targetType);

        if (!relationshipType) {
            res.status(400).json({ message: "Relación inválida." });
            return;
        }

        let query = "";
        let params: Record<string, any> = {
            sourceId,
            targetId
        };
        let createdRelation = {};

        if (relationshipType === "PROVIDES_TO") {
            if (!quantity_of_orders_in_time || !type_product || !range_client) {
                res.status(400).json({ message: "Faltan campos para PROVIDES_TO." });
                return;
            }

            query = `
                MATCH (prov:Provider), (bo:BranchOffice)
                WHERE elementId(prov) = $sourceId AND elementId(bo) = $targetId
                CREATE (prov)-[r:PROVIDES_TO {
                    Quantity_of_orders_in_time: $quantity_of_orders_in_time,
                    Type_product: $type_product,
                    Range_client: $range_client
                }]->(bo)
                RETURN type(r) as relationshipType, r
            `;
            params = {
                ...params,
                quantity_of_orders_in_time,
                type_product,
                range_client
            };
        } 
        else if (relationshipType === "USE") {
            if (!cost_of_operation || !status_payment || !type_vehicle) {
                res.status(400).json({ message: "Faltan campos para USE." });
                return;
            }

            query = `
                MATCH (prov:Provider), (route:Route)
                WHERE elementId(prov) = $sourceId AND elementId(route) = $targetId
                CREATE (prov)-[r:USE {
                    Cost_of_operation: $cost_of_operation,
                    Status_payment: $status_payment,
                    Type_vehicle: $type_vehicle
                }]->(route)
                RETURN type(r) as relationshipType, r
            `;
            params = {
                ...params,
                cost_of_operation,
                status_payment,
                type_vehicle
            };
        }

        const result = await session.run(query, params);
        createdRelation = result.records[0]?.get('r').properties || {};

        res.status(201).json({
            message: "Relación creada exitosamente.",
            sourceId,
            targetId,
            relationshipType,
            properties: createdRelation
        });

    } catch (error) {
        console.error("❌ Error al crear relación (Provider):", error);
        res.status(500).json({ message: "Error al crear relación.", error });
    } finally {
        await session.close();
    }
};

// Función que mapea source y target a un relationshipType para providers
const getProviderRelationshipType = (sourceType: string, targetType: string): string | null => {
    if (sourceType === "provider" && targetType === "branchOffice") {
        return "PROVIDES_TO";
    }
    if (sourceType === "provider" && targetType === "route") {
        return "USE";
    }
    return null;
};
