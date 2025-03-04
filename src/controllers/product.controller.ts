import { Request, Response } from 'express';
import { Neo4jDriverSingleton } from '../config/neo4j.config';
import { productSchema } from '../schemas/product.schema';
import { z } from 'zod';

// Crear producto
export const createProduct = async (req: Request, res: Response): Promise<void> => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const validatedData = productSchema.parse(req.body);
        const { name, category, price, tags, expiration_date } = validatedData;

        const query = `
        CREATE (p:Product {
            Name: $name,
            Category: $category,
            Price: $price,
            Tags: $tags,
            Expiration_date: date($expiration_date),
            Voided: false
        })
        RETURN elementId(p) AS id, p
        `;

        const result = await session.run(query, { name, category, price, tags, expiration_date });

        const record = result.records[0];
        const product = record.get('p').properties;
        const id = record.get('id');

        res.status(201).json({ id, ...product });

    } catch (error) {
        if (error instanceof z.ZodError) {
        res.status(400).json({
            message: 'Error de validación',
            errors: error.errors.map(e => ({ campo: e.path.join('.'), mensaje: e.message }))
        });
        } else {
        res.status(500).json({ message: 'Error al crear producto', error });
        }
    } finally {
        await session.close();
    }
};

// Leer todos los productos
export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const query = `MATCH (p:Product) WHERE p.Voided = false RETURN elementId(p) AS id, p LIMIT 10`;
        const result = await session.run(query);

        const products = result.records.map(record => ({
        id: record.get('id'),
        ...record.get('p').properties
        }));

        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener productos', error });
    } finally {
        await session.close();
    }
};

// Actualizar producto
export const updateProduct = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const validatedData = productSchema.parse(req.body);
        const { name, category, price, tags, expiration_date } = validatedData;

        const query = `
        MATCH (p:Product)
        WHERE elementId(p) = $id
        SET p.Name = $name,
            p.Category = $category,
            p.Price = $price,
            p.TagsArray = $tags,
            p.Expiration_date = date($expiration_date)
        RETURN elementId(p) AS id, p
        `;

        const result = await session.run(query, { id, name, category, price, tags, expiration_date });

        if (result.records.length === 0) {
        res.status(404).json({ message: 'Producto no encontrado' });
        return;
        }

        const record = result.records[0];
        res.json({ id: record.get('id'), ...record.get('p').properties });
    } catch (error) {
        if (error instanceof z.ZodError) {
        res.status(400).json({
            message: 'Error de validación',
            errors: error.errors.map(e => ({ campo: e.path.join('.'), mensaje: e.message }))
        });
        } else {
        res.status(500).json({ message: 'Error al actualizar producto', error });
        }
    } finally {
        await session.close();
    }
};

// Soft delete
export const softDeleteProduct = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();

    try {
        const query = `
        MATCH (p:Product)
        WHERE elementId(p) = $id
        SET p.Voided = true
        RETURN elementId(p) AS id
        `;

        const result = await session.run(query, { id });

        if (result.records.length === 0) {
        res.status(404).json({ message: 'Producto no encontrado' });
        return;
        }

        res.json({ message: 'Producto marcado como eliminado' });
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar producto', error });
    } finally {
        await session.close();
    }
};


// Producto más comprado (Invoice → Products)
export const mostPurchasedProduct = async (req: Request, res: Response): Promise<void> => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();
  
    try {
      const query = `
        MATCH (i:Invoice)-[c:CONTAINS]->(p:Product)
        RETURN elementId(p) AS id, p, SUM(c.Quantity) AS purchaseCount
        ORDER BY purchaseCount DESC
        LIMIT 1
      `;
  
      const result = await session.run(query);
  
      if (result.records.length === 0) {
        res.status(404).json({ message: 'No hay productos comprados' });
        return;
      }
  
      const record = result.records[0];
      res.json({
        id: record.get('id'),
        ...record.get('p').properties,
        purchaseCount: record.get('purchaseCount').toNumber()
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener producto más comprado', error });
    } finally {
      await session.close();
    }
};
  
  // Producto más distribuido (Products → Provider)
export const mostDistributedProduct = async (req: Request, res: Response): Promise<void> => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();
  
    try {
      const query = `
        MATCH (p:Product)<-[b:BELONGS_TO]-(pr:Provider)
        RETURN elementId(p) AS id, p, COUNT(b) AS distributedCount
        ORDER BY distributedCount DESC
        LIMIT 1
      `;
  
      const result = await session.run(query);
  
      if (result.records.length === 0) {
        res.status(404).json({ message: 'No hay productos distribuidos' });
        return;
      }
  
      const record = result.records[0];
      res.json({
        id: record.get('id'),
        ...record.get('p').properties,
        distributedCount: record.get('distributedCount').toNumber()
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener producto más distribuido', error });
    } finally {
      await session.close();
    }
};
  
  // Producto más solicitado entre sucursales (Products exist on Branch office)
export const mostRequestedProductBetweenBranches = async (req: Request, res: Response): Promise<void> => {
    const driver = Neo4jDriverSingleton.getInstance();
    const session = driver.session();
  
    try {
      const query = `
        MATCH (b1:BranchOffice)-[r:REQUESTS]->(p:Product)<-[r2:REQUESTS]-(b2:BranchOffice)
        RETURN elementId(p) AS id, p, COUNT(r) + COUNT(r2) AS requestCount
        ORDER BY requestCount DESC
        LIMIT 1
      `;
  
      const result = await session.run(query);
  
      if (result.records.length === 0) {
        res.status(404).json({ message: 'No hay productos solicitados entre sucursales' });
        return;
      }
  
      const record = result.records[0];
      res.json({
        id: record.get('id'),
        ...record.get('p').properties,
        requestCount: record.get('requestCount').toNumber()
      });
    } catch (error) {
      res.status(500).json({ message: 'Error al obtener producto más solicitado entre sucursales', error });
    } finally {
      await session.close();
    }
};


export const getProductRelationshipsById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const driver = Neo4jDriverSingleton.getInstance();
  const session = driver.session();
  try {
      const query = `
          MATCH (p1:Product)-[r]->(p2:Product)
          WHERE elementId(p1) = $productId AND p2.Voided = false
          RETURN elementId(r) AS id, elementId(p1) AS source, elementId(p2) AS target, type(r) AS type
      `;

      const result = await session.run(query, { productId: id });

      const relationships = result.records.map(record => ({
          id: record.get('id'),
          source: record.get('source'),
          target: record.get('target'),
          type: record.get('type') // opcional, por si quieres mostrar el tipo de relación
      }));

      res.json(relationships);
  } catch (error) {
      res.status(500).json({ message: 'Error al obtener relaciones del producto', error });
  } finally {
      await session.close();
  }
};


export const createProductRelationship = async (req: Request, res: Response): Promise<void> => {
  const { sourceId, targetId } = req.body;

  if (!sourceId || !targetId) {
      res.status(400).json({ message: "sourceId y targetId son requeridos" });
      return;
  }

  const driver = Neo4jDriverSingleton.getInstance();
  const session = driver.session();

  try {
      const query = `
          MATCH (p1:Product), (p2:Product)
          WHERE elementId(p1) = $sourceId AND elementId(p2) = $targetId
          MERGE (p1)-[:SEEMS]->(p2)
      `;
      await session.run(query, { sourceId, targetId });

      res.status(201).json({ message: 'Relación creada exitosamente' });
  } catch (error) {
      res.status(500).json({ message: 'Error al crear relación', error });
  } finally {
      await session.close();
  }
};
