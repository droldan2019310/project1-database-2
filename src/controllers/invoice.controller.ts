import { Request, Response } from "express";
import { Neo4jDriverSingleton } from "../config/neo4j.config";
import { invoiceSchema } from "../schemas/invoice.schemas";
import { z } from "zod";

// Crear factura
export const createInvoice = async (req: Request, res: Response): Promise<void> => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const validatedData = invoiceSchema.parse(req.body);
        const { id, name, nit, total, cashier_main, date, status, notes } = validatedData;

        const query = `
        CREATE (i:Invoice {
            ID: $id,
            Name: $name,
            NIT: $nit,
            Total: $total,
            Cashier_main: $cashier_main,
            Date: date($date),
            Status: $status,
            Notes: $notes,
            Voided: false
        })
        RETURN elementId(i) AS id, i
        `;

        const result = await session.run(query, validatedData);
        res.status(201).json({ id: result.records[0].get("id"), ...result.records[0].get("i").properties });

    } catch (error) {
        res.status(400).json({ message: "Error al crear factura", error });
    } finally {
        await session.close();
    }
};

// Obtener todas las facturas activas
export const getInvoices = async (req: Request, res: Response): Promise<void> => {
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

        // 🔍 Query para obtener facturas y productos relacionados
        const query = `
            MATCH (i:Invoice)
            WHERE i.Voided = false
            OPTIONAL MATCH (i)-[r:CONTAINS]->(p:Product)
            RETURN 
                toString(elementId(i)) AS invoiceId, 
                i, 
                toString(elementId(p)) AS productId, 
                p, 
                type(r) AS relationshipType
            ORDER BY i.Date ASC
            SKIP ${offset} LIMIT ${limitNumber}
        `;

        const result = await session.run(query);

        // Mapeo y agrupación por factura
        const invoiceMap = new Map<string, any>();

        result.records.forEach(record => {
            const invoiceId = record.get('invoiceId');
            const invoiceProperties = record.get('i').properties;

            if (!invoiceMap.has(invoiceId)) {
                invoiceMap.set(invoiceId, {
                    id: invoiceId,
                    ...invoiceProperties,
                    products: []  // Inicialmente vacío
                });
            }

            const productId = record.get('productId');
            if (productId) {
                const productProperties = record.get('p').properties;
                invoiceMap.get(invoiceId).products.push({
                    id: productId,
                    ...productProperties,
                    relationshipType: record.get('relationshipType')
                });
            }
        });

        const invoices = Array.from(invoiceMap.values());

        // 📊 Contar total de facturas (independiente de la paginación)
        const countResult = await session.run(`
            MATCH (i:Invoice)
            WHERE i.Voided = false
            RETURN count(i) AS total
        `);

        const totalInvoices = countResult.records[0]?.get("total").toNumber() || 0;

        res.json({
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(totalInvoices / limitNumber),
            totalInvoices,
            invoices
        });

    } catch (error) {
        console.error("❌ Error al obtener facturas:", error);
        res.status(500).json({ message: 'Error al obtener facturas', error });
    } finally {
        await session.close();
    }
};

export const getInvoicesByCashier = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const { cashier_main } = req.params;  // Recibe el nombre del cajero desde el URL (path param)

        // 🔍 Query para buscar facturas por Cashier_main (ignorando mayúsculas/minúsculas)
        const query = `
            MATCH (i:Invoice)
            WHERE toLower(i.Cashier_main) CONTAINS toLower($cashier_main) AND i.Voided = false
            OPTIONAL MATCH (i)-[r:CONTAINS]->(p:Product)
            RETURN 
                toString(elementId(i)) AS invoiceId, 
                i, 
                toString(elementId(p)) AS productId, 
                p, 
                type(r) AS relationshipType
            ORDER BY i.Date ASC
        `;

        const result = await session.run(query, {
            cashier_main
        });

        // Mapeo y agrupación por factura
        const invoiceMap = new Map<string, any>();

        result.records.forEach(record => {
            const invoiceId = record.get('invoiceId');
            const invoiceProperties = record.get('i').properties;

            if (!invoiceMap.has(invoiceId)) {
                invoiceMap.set(invoiceId, {
                    id: invoiceId,
                    ...invoiceProperties,
                    products: []  // Inicialmente vacío
                });
            }

            const productId = record.get('productId');
            if (productId) {
                const productProperties = record.get('p').properties;
                invoiceMap.get(invoiceId).products.push({
                    id: productId,
                    ...productProperties,
                    relationshipType: record.get('relationshipType')
                });
            }
        });

        const invoices = Array.from(invoiceMap.values());

       


        res.json({
            invoices
        });

    } catch (error) {
        console.error("❌ Error al buscar facturas por cajero:", error);
        res.status(500).json({ message: 'Error al buscar facturas por cajero', error });
    } finally {
        await session.close();
    }
};



// Soft delete (marcar factura como eliminada)
export const softDeleteInvoice = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const result = await session.run(`MATCH (i:Invoice) WHERE elementId(i) = $id SET i.Voided = true RETURN i`, { id });
        if (result.records.length === 0) {
            res.status(404).json({ message: "Factura no encontrada" });
            return;
        }
        res.json({ message: "Factura marcada como eliminada" });

    } catch (error) {
        res.status(500).json({ message: "Error al eliminar factura", error });
    } finally {
        await session.close();
    }
};

// Actualizar una factura
export const updateInvoice = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const validatedData = invoiceSchema.parse(req.body);
        const { name, nit, total, cashier_main, date, status, notes } = validatedData;

        const query = `
        MATCH (i:Invoice)
        WHERE elementId(i) = $id
        SET i.Name = $name,
            i.NIT = $nit,
            i.Total = $total,
            i.Cashier_main = $cashier_main,
            i.Date = date($date),
            i.Status = $status,
            i.Notes = $notes
        RETURN elementId(i) AS id, i
        `;

        const result = await session.run(query, { id, name, nit, total, cashier_main, date, status, notes });

        if (result.records.length === 0) {
            res.status(404).json({ message: "Factura no encontrada" });
            return;
        }

        res.json({ id: result.records[0].get("id"), ...result.records[0].get("i").properties });

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                message: "Error de validación",
                errors: error.errors.map(e => ({ campo: e.path.join("."), mensaje: e.message }))
            });
        } else {
            res.status(500).json({ message: "Error al actualizar factura", error });
        }
    } finally {
        await session.close();
    }
};

// Obtener sucursales con más facturas emitidas
export const getTopBranchesByInvoices = async (_req: Request, res: Response): Promise<void> => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const result = await session.run(`
            MATCH (b:BranchOffice)-[:EMITS]->(i:Invoice)
            WHERE i.Voided = false
            RETURN b.Name AS Branch, COUNT(i) AS TotalInvoices
            ORDER BY TotalInvoices DESC
            LIMIT 5
        `);

        res.json(result.records.map(record => ({
            branch: record.get("Branch"),
            totalInvoices: record.get("TotalInvoices")
        })));

    } catch (error) {
        res.status(500).json({ message: "Error al obtener sucursales", error });
    } finally {
        await session.close();
    }
};




import { buyOrderSchema } from '../schemas/buyOrder.schema'; // Debes crear el schema de validación

export const createBuyOrder = async (req: Request, res: Response): Promise<void> => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const validatedData = buyOrderSchema.parse(req.body);
        const { id, status, total, items, date, voided } = validatedData;

        const query = `
        CREATE (b:BuyOrder {
            ID: $id,
            Status: $status,
            Total: $total,
            Items: $items,
            Voided: $voided
        })
        RETURN elementId(b) AS id, b
        `;

        const params = {
            id,
            status,
            total,
            items,
           
            voided
        };

        const result = await session.run(query, params);

        res.status(201).json({
            id: result.records[0].get("id"),
            ...result.records[0].get("b").properties
        });

    } catch (error) {
        res.status(400).json({ message: "Error al crear orden de compra", error });
    } finally {
        await session.close();
    }
};



export const createRelationshipInvoice = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const {
            sourceId,   // elementId() de la factura (Invoice)
            targetId,   // elementId() del producto (Product)
            quantity,
            discount,
            price,
            sub_total
        } = req.body;

        if (!sourceId || !targetId || quantity === undefined || discount === undefined || price === undefined || sub_total === undefined) {
            res.status(400).json({ message: "Faltan parámetros obligatorios para la relación." });
            return;
        }

        const query = `
            MATCH (invoice:Invoice), (product:Product)
            WHERE elementId(invoice) = $sourceId AND elementId(product) = $targetId
            CREATE (invoice)-[r:CONTAINS {
                Quantity: $quantity,
                Discount: $discount,
                Price: $price,
                Sub_total: $sub_total
            }]->(product)
            RETURN type(r) as relationshipType, r
        `;

        const params = {
            sourceId,
            targetId,
            quantity: parseInt(quantity, 10),
            discount: parseFloat(discount),
            price: parseFloat(price),
            sub_total: parseFloat(sub_total),
        };

        console.log('📄 Ejecutando query:', query);
        console.log('🔗 Con parámetros:', params);

        const result = await session.run(query, params);

        const relationship = result.records[0]?.get('r').properties || {};

        res.status(201).json({
            message: "Relación creada exitosamente.",
            sourceId,
            targetId,
            relationshipType: "CONTAINS",
            properties: relationship
        });

    } catch (error) {
        console.error("❌ Error al crear relación (Invoice → Product):", error);
        res.status(500).json({ message: "Error al crear relación (Invoice → Product)", error });
    } finally {
        await session.close();
    }
};


