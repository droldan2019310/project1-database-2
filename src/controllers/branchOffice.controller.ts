// src/controllers/branchOffice.controller.ts
import { Request, Response } from 'express';
import { Neo4jDriverSingleton } from '../config/neo4j.config';
import { branchOfficeSchema } from '../schemas/branchOffice.schema';
import { z } from 'zod';

// Crear sucursal
export const createBranchOffice = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const validatedData = branchOfficeSchema.parse(req.body);
        const { name, location, income } = validatedData;

        const query = `
            CREATE (b:BranchOffice {
                ID: randomUUID(),
                Name: $name,
                Location: $location,
                Income: $income,
                Voided: false
            })
            RETURN elementId(b) AS id, b
        `;

        const result = await session.run(query, { name, location, income });
        const record = result.records[0];

        res.status(201).json({ id: record.get('id'), ...record.get('b').properties });

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ message: 'Error de validación', errors: error.errors });
        } else {
            res.status(500).json({ message: 'Error al crear sucursal', error });
        }
    } finally {
        await session.close();
    }
};

// Leer todas las sucursales
export const getAllBranchOffices = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

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

        // Query actualizada para traer sucursales con facturas (EMITS) y órdenes de compra (CREATES_A)
        const query = `
            MATCH (b:BranchOffice)
            WHERE b.Voided = false
            OPTIONAL MATCH (b)-[emits:EMITS]->(i:Invoice)
            OPTIONAL MATCH (b)-[creates:CREATES_A]->(bo:BuyOrder)
            RETURN 
                toString(elementId(b)) AS branchOfficeId, 
                b, 
                toString(elementId(i)) AS invoiceId, 
                i, 
                type(emits) AS emitsRelationship,
                toString(elementId(bo)) AS buyOrderId, 
                bo, 
                type(creates) AS createsRelationship
            ORDER BY b.Name ASC
            SKIP ${offset} LIMIT ${limitNumber}
        `;

        const result = await session.run(query);

        // Mapeo y agrupación por sucursal
        const branchMap = new Map<string, any>();

        result.records.forEach(record => {
            const branchOfficeId = record.get('branchOfficeId');
            const branchProperties = record.get('b').properties;

            if (!branchMap.has(branchOfficeId)) {
                branchMap.set(branchOfficeId, {
                    id: branchOfficeId,
                    ...branchProperties,
                    invoices: [],
                    buyOrders: []
                });
            }

            // Facturas (Invoices)
            const invoiceId = record.get('invoiceId');
            if (invoiceId) {
                const invoiceProperties = record.get('i').properties;
                branchMap.get(branchOfficeId).invoices.push({
                    id: invoiceId,
                    ...invoiceProperties,
                    relationshipType: record.get('emitsRelationship')
                });
            }

            // Órdenes de compra (BuyOrders)
            const buyOrderId = record.get('buyOrderId');
            if (buyOrderId) {
                const buyOrderProperties = record.get('bo').properties;
                branchMap.get(branchOfficeId).buyOrders.push({
                    id: buyOrderId,
                    ...buyOrderProperties,
                    relationshipType: record.get('createsRelationship')
                });
            }
        });

        const branchOffices = Array.from(branchMap.values());

        // 📊 Contar total de sucursales
        const countResult = await session.run(`
            MATCH (b:BranchOffice)
            WHERE b.Voided = false
            RETURN count(b) AS total
        `);

        const totalBranches = countResult.records[0]?.get("total").toNumber() || 0;

        res.json({
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(totalBranches / limitNumber),
            totalBranches,
            branchOffices
        });

    } catch (error) {
        console.error("❌ Error al obtener sucursales:", error);
        res.status(500).json({ message: 'Error al obtener sucursales', error });
    } finally {
        await session.close();
    }
};







// Actualizar sucursal
export const updateBranchOffice = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const validatedData = branchOfficeSchema.parse(req.body);
        const { name, location, income } = validatedData;

        const query = `
            MATCH (b:BranchOffice) WHERE elementId(b) = $id
            SET b.Name = $name, b.Location = $location, b.Income = $income
            RETURN elementId(b) AS id, b
        `;

        const result = await session.run(query, { id, name, location, income });

        if (result.records.length === 0) {
            res.status(404).json({ message: 'Sucursal no encontrada' });
            return;
        }

        res.json({ id, ...result.records[0].get('b').properties });

    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar sucursal', error });
    } finally {
        await session.close();
    }
};

// Soft delete de sucursal
export const softDeleteBranchOffice = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const query = `
            MATCH (b:BranchOffice) WHERE elementId(b) = $id
            SET b.Voided = true
            RETURN elementId(b) AS id
        `;

        const result = await session.run(query, { id });

        if (result.records.length === 0) {
            res.status(404).json({ message: 'Sucursal no encontrada' });
            return;
        }

        res.json({ message: 'Sucursal eliminada (soft delete)' });

    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar sucursal', error });
    } finally {
        await session.close();
    }
};

// Top 5 sucursales con más ventas
export const top5BranchesWithMostSales = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const query = `
            MATCH (b:BranchOffice)-[:EMITS]->(i:Invoice)
            RETURN elementId(b) AS id, b, COUNT(i) AS salesCount
            ORDER BY salesCount DESC
            LIMIT 5
        `;

        const result = await session.run(query);

        const branches = result.records.map(record => ({
            id: record.get('id'),
            ...record.get('b').properties,
            salesCount: record.get('salesCount').toNumber()
        }));

        res.json(branches);

    } catch (error) {
        res.status(500).json({ message: 'Error al obtener el top 5', error });
    } finally {
        await session.close();
    }
};

// Sucursales que necesitan mejor distribución
export const branchesNeedingBetterDistribution = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const query = `
            MATCH (pr:Provider)-[:PROVIDES_TO]->(b:BranchOffice)<-[:LEAVES_ON]-(r:Route)
            WHERE toFloat(r.Distance_KM) > 1950
            RETURN 
                toString(elementId(b)) AS branchOfficeId,
                b,
                toString(elementId(pr)) AS providerId,
                pr,
                toString(elementId(r)) AS routeId,
                r
            ORDER BY r.Distance_KM DESC
        `;

        const result = await session.run(query);

        const branches = result.records.map(record => {
            const branchProperties = record.get('b').properties;
            const providerProperties = record.get('pr').properties;
            const routeProperties = record.get('r').properties;

            return {
                branchOffice: {
                    id: record.get('branchOfficeId'),
                    ...branchProperties
                },
                provider: {
                    id: record.get('providerId'),
                    ...providerProperties
                },
                route: {
                    id: record.get('routeId'),
                    ...routeProperties,
                    Distance_KM: parseFloat(routeProperties.Distance_KM) // Aseguramos que es número
                }
            };
        });

        res.json(branches);

    } catch (error) {
        console.error("❌ Error al obtener sucursales con mala distribución:", error);
        res.status(500).json({ message: 'Error al obtener sucursales con mala distribución', error });
    } finally {
        await session.close();
    }
};

// Productos más vendidos por sucursal
export const topProductsPerBranch = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const query = `
            MATCH (b:BranchOffice)-[:EMITS]->(i:Invoice)-[c:CONTAINS]->(p:Product)
            WHERE elementId(b) = $id
            RETURN elementId(p) AS productId, p, SUM(c.Quantity) AS totalSold
            ORDER BY totalSold DESC
            LIMIT 5
        `;

        const result = await session.run(query, { id });

        const products = result.records.map(record => ({
            productId: record.get('productId'),
            ...record.get('p').properties,
            totalSold: record.get('totalSold').toNumber()
        }));

        res.json(products);

    } catch (error) {
        res.status(500).json({ message: 'Error al obtener productos más vendidos', error });
    } finally {
        await session.close();
    }
};



export const createRelationshipBranch = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const {
            sourceId,        // elementId() de la BranchOffice
            targetId,        // elementId() de la Invoice o BuyOrder
            targetType,      // "invoice" o "buyOrder"
            nit_remitente,
            direccion_remitente,
            telefono_remitente,
            date_created,
            cashier,
            type_payment
        } = req.body;

        console.log("📥 Request Body:", req.body);

        if (!sourceId || !targetId || !targetType) {
            res.status(400).json({ message: "Faltan parámetros obligatorios." });
            return;
        }

        let query = "";
        let params: Record<string, any> = { sourceId, targetId };
        let createdRelation = {};

        if (targetType === "invoice") {
            if (!nit_remitente || !direccion_remitente || !telefono_remitente) {
                res.status(400).json({ message: "Faltan campos para la relación EMITS." });
                return;
            }

            query = `
                MATCH (branch:BranchOffice), (invoice:Invoice)
                WHERE elementId(branch) = $sourceId AND elementId(invoice) = $targetId
                CREATE (branch)-[r:EMITS {
                    NIT_remitente: $nit_remitente,
                    Direccion_remitente: $direccion_remitente,
                    Telefono_remitente: $telefono_remitente
                }]->(invoice)
                RETURN type(r) as relationshipType, r
            `;

            params = {
                ...params,
                nit_remitente,
                direccion_remitente,
                telefono_remitente
            };
        } 
        else if (targetType === "buyOrder") {
            if (!date_created || !cashier || !type_payment) {
                res.status(400).json({ message: "Faltan campos para la relación CREATES_A." });
                return;
            }

            // Neo4j necesita el date como { year, month, day }
            const [year, month, day] = date_created.split('-').map(Number);

            query = `
                MATCH (branch:BranchOffice), (buyOrder:BuyOrder)
                WHERE elementId(branch) = "${sourceId}" AND elementId(buyOrder) = "${targetId}"
                CREATE (branch)-[r:CREATES_A {
                    Date_created: date({ year: ${year}, month: ${month}, day: ${day} }),
                    Cashier: "${cashier}",
                    Type_payment: "${type_payment}"
                }]->(buyOrder)
                RETURN type(r) as relationshipType, r
            `;


            params = {
                
            };
        } 
        else {
            res.status(400).json({ message: "Relación inválida." });
            return;
        }

        console.log('📄 Ejecutando query:', query);
        console.log('🔗 Con parámetros:', params);

        const result = await session.run(query, params);
        createdRelation = result.records[0]?.get('r').properties || {};

        res.status(201).json({
            message: "Relación creada exitosamente.",
            sourceId,
            targetId,
            relationshipType: result.records[0]?.get('relationshipType'),
            properties: createdRelation
        });

    } catch (error) {
        console.error("❌ Error al crear relación (BranchOffice):", error);
        res.status(500).json({ message: "Error al crear relación.", error });
    } finally {
        await session.close();
    }
};

