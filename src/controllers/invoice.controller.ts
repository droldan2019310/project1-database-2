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
export const getInvoices = async (_req: Request, res: Response): Promise<void> => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const result = await session.run(`MATCH (i:Invoice) WHERE i.Voided = false RETURN elementId(i) AS id, i`);
        res.json(result.records.map(record => ({ id: record.get("id"), ...record.get("i").properties })));

    } catch (error) {
        res.status(500).json({ message: "Error al obtener facturas", error });
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