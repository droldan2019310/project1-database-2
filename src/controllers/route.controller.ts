import { Request, Response } from 'express';
import { Neo4jDriverSingleton } from '../config/neo4j.config';
import { routeSchema } from '../schemas/route.schema';
import { z } from 'zod';

// Crear ruta


export const createRoute = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const validatedData = routeSchema.parse(req.body);
        const { quantity, delivery_name, arrive_date, arrive_hour, company, distance_km } = validatedData;

        const query = `
            CREATE (r:Route {
                Quantity: $quantity,
                Name: $delivery_name,
                Arrive_date: date($arrive_date),
                Arrive_hour: $arrive_hour,
                Company: $company,
                Distance_KM: $distance_km,
                Voided: false
            })
            RETURN elementId(r) AS id, r
        `;

        const result = await session.run(query, { quantity, delivery_name, arrive_date, arrive_hour, company, distance_km });
        const record = result.records[0];

        res.status(201).json({ id: record.get('id'), ...record.get('r').properties });

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ message: 'Error de validación', errors: error.errors });
        } else {
            console.error("❌ Error al crear ruta:", error);
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

        // 🔍 Query combinada para traer rutas y sus relaciones (opcionalmente)
        const query = `
            MATCH (r:Route)
            WHERE r.Voided = false
            OPTIONAL MATCH (r)-[leavesOn:LEAVES_ON]->(b:BranchOffice)
            OPTIONAL MATCH (r)-[carry:CARRY]->(p:Product)
            RETURN 
                toString(elementId(r)) AS routeId, 
                r,
                toString(elementId(b)) AS branchOfficeId,
                b,
                type(leavesOn) AS leavesOnType,
                toString(elementId(p)) AS productId,
                p,
                type(carry) AS carryType
            ORDER BY r.Name ASC
            SKIP ${offset} LIMIT ${limitNumber}
        `;

        const result = await session.run(query);

        // Mapeo por cada ruta, agregando branch office y products si existen
        const routeMap = new Map<string, any>();

        result.records.forEach(record => {
            const routeId = record.get('routeId');
            const routeProperties = record.get('r').properties;

            if (!routeMap.has(routeId)) {
                routeMap.set(routeId, {
                    id: routeId,
                    ...routeProperties,
                    branchOffice: null,     // Default si no hay relación
                    products: []             // Default vacío si no hay relación
                });
            }

            // Manejo de la relación leaves_on (branch office)
            const branchOfficeId = record.get('branchOfficeId');
            if (branchOfficeId) {
                const branchOfficeProperties = record.get('b').properties;
                routeMap.get(routeId).branchOffice = {
                    id: branchOfficeId,
                    ...branchOfficeProperties,
                    relationshipType: record.get('leavesOnType')
                };
            }

            // Manejo de la relación carry (products)
            const productId = record.get('productId');
            if (productId) {
                const productProperties = record.get('p').properties;
                routeMap.get(routeId).products.push({
                    id: productId,
                    ...productProperties,
                    relationshipType: record.get('carryType')
                });
            }
        });

        const routes = Array.from(routeMap.values());

        // 📊 Contar total de rutas
        const countResult = await session.run(`
            MATCH (r:Route)
            WHERE r.Voided = false
            RETURN count(r) AS total
        `);

        const totalRoutes = countResult.records[0]?.get("total").toNumber() || 0;

        res.json({
            page: pageNumber,
            limit: limitNumber,
            totalPages: Math.ceil(totalRoutes / limitNumber),
            totalRoutes,
            routes
        });

    } catch (error) {
        console.error("❌ Error al obtener rutas:", error);
        res.status(500).json({ message: 'Error al obtener rutas', error });
    } finally {
        await session.close();
    }
};


export const getRoutesByCompany = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const { company } = req.params; // La empresa viene como parámetro de ruta (path param)

        if (!company || company.trim() === "") {
            res.status(400).json({ message: "El parámetro 'company' es obligatorio." });
            return;
        }

        const query = `
            MATCH (r:Route)
            WHERE toLower(r.Company) CONTAINS toLower($company) AND r.Voided = false
            OPTIONAL MATCH (r)-[leavesOn:LEAVES_ON]->(b:BranchOffice)
            OPTIONAL MATCH (r)-[carry:CARRY]->(p:Product)
            RETURN 
                toString(elementId(r)) AS routeId, 
                r,
                toString(elementId(b)) AS branchOfficeId,
                b,
                type(leavesOn) AS leavesOnType,
                toString(elementId(p)) AS productId,
                p,
                type(carry) AS carryType
        `;

        const result = await session.run(query, { company });

        // Mapeo por cada ruta, agregando branch office y products si existen
        const routeMap = new Map<string, any>();

        result.records.forEach(record => {
            const routeId = record.get('routeId');
            const routeProperties = record.get('r').properties;

            if (!routeMap.has(routeId)) {
                routeMap.set(routeId, {
                    id: routeId,
                    ...routeProperties,
                    branchOffice: null,     // Default si no hay relación
                    products: []             // Default vacío si no hay relación
                });
            }

            // Manejo de la relación leaves_on (branch office)
            const branchOfficeId = record.get('branchOfficeId');
            if (branchOfficeId) {
                const branchOfficeProperties = record.get('b').properties;
                routeMap.get(routeId).branchOffice = {
                    id: branchOfficeId,
                    ...branchOfficeProperties,
                    relationshipType: record.get('leavesOnType')
                };
            }

            // Manejo de la relación carry (products)
            const productId = record.get('productId');
            if (productId) {
                const productProperties = record.get('p').properties;
                routeMap.get(routeId).products.push({
                    id: productId,
                    ...productProperties,
                    relationshipType: record.get('carryType')
                });
            }
        });

        const routes = Array.from(routeMap.values());

        res.json({ routes });

    } catch (error) {
        console.error("❌ Error al buscar rutas por compañía:", error);
        res.status(500).json({ message: 'Error al buscar rutas por compañía', error });
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
                r.Name = $delivery_name,
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
            duration: result.records[0].get('duration')
        });

    } catch (error) {
        console.log(error);
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
