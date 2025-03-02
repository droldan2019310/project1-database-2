import { Request, Response } from 'express';
import { Neo4jDriverSingleton } from '../config/neo4j.config';
import { routeSchema } from '../schemas/route.schema';
import { z } from 'zod';

// Crear ruta
export const createRoute = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const validatedData = routeSchema.parse(req.body);
        const { quantity, delivery_name, arrive_date, arrive_hour } = validatedData;

        const query = `
            CREATE (r:Route {
                Quantity: $quantity,
                Delivery_name: $delivery_name,
                Arrive_date: date($arrive_date),
                Arrive_hour: $arrive_hour,
                Voided: false
            })
            RETURN elementId(r) AS id, r
        `;

        const result = await session.run(query, { quantity, delivery_name, arrive_date, arrive_hour });
        const record = result.records[0];

        res.status(201).json({ id: record.get('id'), ...record.get('r').properties });

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ message: 'Error de validación', errors: error.errors });
        } else {
            res.status(500).json({ message: 'Error al crear ruta', error });
        }
    } finally {
        await session.close();
    }
};

// Consultar todas las rutas
export const getAllRoutes = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const query = `MATCH (r:Route) WHERE r.Voided = false RETURN elementId(r) AS id, r`;
        const result = await session.run(query);

        const routes = result.records.map(record => ({
            id: record.get('id'),
            ...record.get('r').properties
        }));

        res.json(routes);

    } catch (error) {
        res.status(500).json({ message: 'Error al obtener rutas', error });
    } finally {
        await session.close();
    }
};

// Actualizar ruta
export const updateRoute = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const validatedData = routeSchema.parse(req.body);
        const { quantity, delivery_name, arrive_date, arrive_hour } = validatedData;

        const query = `
            MATCH (r:Route) WHERE elementId(r) = $id
            SET r.Quantity = $quantity,
                r.Delivery_name = $delivery_name,
                r.Arrive_date = date($arrive_date),
                r.Arrive_hour = $arrive_hour
            RETURN elementId(r) AS id, r
        `;

        const result = await session.run(query, { id, quantity, delivery_name, arrive_date, arrive_hour });

        if (result.records.length === 0) {
            res.status(404).json({ message: 'Ruta no encontrada' });
            return;
        }

        res.json({ id, ...result.records[0].get('r').properties });

    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar ruta', error });
    } finally {
        await session.close();
    }
};

// Soft delete ruta
export const softDeleteRoute = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const query = `
            MATCH (r:Route) WHERE elementId(r) = $id
            SET r.Voided = true
        `;

        const result = await session.run(query, { id });

        if (result.summary.counters.updates().propertiesSet === 0) {
            res.status(404).json({ message: 'Ruta no encontrada' });
            return;
        }

        res.json({ message: 'Ruta eliminada (soft delete)' });

    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar ruta', error });
    } finally {
        await session.close();
    }
};

// Ruta más cargada (mayor cantidad de productos)
export const mostLoadedRoute = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const query = `
            MATCH (r:Route)
            RETURN elementId(r) AS id, r
            ORDER BY r.Quantity DESC
            LIMIT 1
        `;

        const result = await session.run(query);

        if (result.records.length === 0) {
            res.status(404).json({ message: 'No hay rutas registradas' });
            return;
        }

        res.json({
            id: result.records[0].get('id'),
            ...result.records[0].get('r').properties
        });

    } catch (error) {
        res.status(500).json({ message: 'Error al obtener ruta más cargada', error });
    } finally {
        await session.close();
    }
};

// Ruta que lleva más tiempo (diferencia entre fecha de salida y llegada)
export const longestTimeRoute = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const query = `
            MATCH (r:Route)
            RETURN elementId(r) AS id, r, duration.between(date(r.Create_date), date(r.Arrive_date)) AS duration
            ORDER BY duration DESC
            LIMIT 1
        `;

        const result = await session.run(query);

        if (result.records.length === 0) {
            res.status(404).json({ message: 'No hay rutas registradas' });
            return;
        }

        res.json({
            id: result.records[0].get('id'),
            ...result.records[0].get('r').properties,
            duration: result.records[0].get('duration').toString()
        });

    } catch (error) {
        res.status(500).json({ message: 'Error al obtener ruta más larga', error });
    } finally {
        await session.close();
    }
};

// Ruta que recorre más km (si tienes propiedad Distance o similar)
export const longestDistanceRoute = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const query = `
            MATCH (r:Route)
            RETURN elementId(r) AS id, r
            ORDER BY r.Distance DESC
            LIMIT 1
        `;

        const result = await session.run(query);

        if (result.records.length === 0) {
            res.status(404).json({ message: 'No hay rutas registradas' });
            return;
        }

        res.json({
            id: result.records[0].get('id'),
            ...result.records[0].get('r').properties
        });

    } catch (error) {
        res.status(500).json({ message: 'Error al obtener ruta más larga en distancia', error });
    } finally {
        await session.close();
    }
};
