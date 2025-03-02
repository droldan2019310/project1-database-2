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
export const getProviders = async (_req: Request, res: Response): Promise<void> => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const result = await session.run(`MATCH (p:Provider) WHERE p.Voided = false RETURN elementId(p) AS id, p`);
        res.json(result.records.map(record => ({ id: record.get("id"), ...record.get("p").properties })));

    } catch (error) {
        res.status(500).json({ message: "Error al obtener proveedores", error });
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