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

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
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

      // 🔍 Query con relaciones directo con offset y limit concatenados
      const query = `
          MATCH (p:Product)
          WHERE p.Voided = false
          OPTIONAL MATCH (p)-[:BELONGS_TO]->(provider:Provider)
          OPTIONAL MATCH (p)-[:EXIST_ON]->(branch:BranchOffice)
          RETURN 
              toString(elementId(p)) AS productId,
              p,
              toString(elementId(provider)) AS providerId,
              provider,
              toString(elementId(branch)) AS branchId,
              branch
          ORDER BY p.Name ASC
          SKIP ${offset} LIMIT ${limitNumber}
      `;

      const result = await session.run(query);

      const productMap = new Map<string, any>();

      result.records.forEach(record => {
          const productId = record.get('productId');
          const productProps = record.get('p').properties;

          if (!productMap.has(productId)) {
              productMap.set(productId, {
                  id: productId,
                  ...productProps,
                  provider: null,
                  branchOffices: []
              });
          }

          const providerId = record.get('providerId');
          if (providerId) {
              productMap.get(productId).provider = {
                  id: providerId,
                  ...record.get('provider').properties
              };
          }

          const branchId = record.get('branchId');
          if (branchId) {
              productMap.get(productId).branchOffices.push({
                  id: branchId,
                  ...record.get('branch').properties
              });
          }
      });

      const products = Array.from(productMap.values());

      // 📊 Contar total de productos
      const countResult = await session.run(`
          MATCH (p:Product)
          WHERE p.Voided = false
          RETURN count(p) AS total
      `);

      const totalProducts = countResult.records[0]?.get("total").toNumber() || 0;

      res.json({
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(totalProducts / limitNumber),
          totalProducts,
          products
      });

  } catch (error) {
      console.error("❌ Error al obtener productos:", error);
      res.status(500).json({ message: "Error al obtener productos", error });
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
        purchaseCount: record.get('purchaseCount')
      });
    } catch (error) {
      console.log(error);
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


export const getProductByName = async (req: Request, res: Response): Promise<void> => {
  const driver = Neo4jDriverSingleton.getInstance();
  const session = driver.session();

  try {
      const { name } = req.params;

      if (!name) {
          res.status(400).json({ message: "El nombre del producto es obligatorio" });
          return;
      }

      const query = `
          MATCH (p:Product {Name: $name})
          WHERE p.Voided = false
          OPTIONAL MATCH (p)-[:BELONGS_TO]->(pr:Provider)
          OPTIONAL MATCH (p)-[:EXISTS_ON]->(b:BranchOffice)

          RETURN 
              toString(elementId(p)) AS productId,
              p,
              toString(elementId(pr)) AS providerId,
              pr,
              toString(elementId(b)) AS branchId,
              b
      `;

      const result = await session.run(query, { name });

      if (result.records.length === 0) {
          res.status(404).json({ message: "Producto no encontrado" });
          return;
      }

      const productData = {
          id: result.records[0].get('productId'),
          ...result.records[0].get('p').properties,
          provider: [],
          branchOffices: []
      };

      result.records.forEach(record => {
          if (record.get('providerId') && record.get('pr')) {
              productData.provider = {
                  id: record.get('providerId'),
                  ...record.get('pr').properties
              };
          }

          if (record.get('branchId') && record.get('b')) {
              productData.branchOffices.push({
                  id: record.get('branchId'),
                  ...record.get('b').properties
              });
          }
      });

      res.json(productData);

  } catch (error) {
      console.error("❌ Error al buscar producto por nombre:", error);
      res.status(500).json({ message: "Error al buscar producto", error });
  } finally {
      await session.close();
  }
};


export const createProductRelationshipProducts = async (req: Request, res: Response): Promise<void> => {
    const session = Neo4jDriverSingleton.getInstance().session();

    try {
        const {
            sourceId,
            targetId,
            sourceType,
            targetType,
            create_date,
            time_to_create,
            actual_stock,
            buy_date,
            minimum_stock
        } = req.body;

        console.log("📥 Request Body:", req.body);

        if (!sourceId || !targetId || !sourceType || !targetType) {
            res.status(400).json({ message: "Faltan parámetros obligatorios." });
            return;
        }

        const relationshipType = getRelationshipType(sourceType, targetType);

        if (!relationshipType) {
            res.status(400).json({ message: "Relación inválida." });
            return;
        }

        let query = "";
        let params: Record<string, any> = { sourceId, targetId };
        let createdRelation = {};

        if (relationshipType === "BELONGS_TO") {
            if (!create_date || !time_to_create) {
                res.status(400).json({ message: "Faltan campos para BELONGS_TO." });
                return;
            }
            query = `
                MATCH (p:Product), (prov:Provider)
                WHERE elementId(p) = $sourceId AND elementId(prov) = $targetId
                CREATE (p)-[r:BELONGS_TO {
                    Create_date: date($create_date),
                    Time_to_create: $time_to_create
                }]->(prov)
                RETURN type(r) as relationshipType, r
            `;
            params = { ...params, create_date, time_to_create };
        } 
        else if (relationshipType === "EXISTS_ON") {
            if (!actual_stock || !buy_date || !minimum_stock) {
                res.status(400).json({ message: "Faltan campos para EXISTS_ON." });
                return;
            }
            query = `
                MATCH (p:Product), (bo:BranchOffice)
                WHERE elementId(p) = $sourceId AND elementId(bo) = $targetId
                CREATE (p)-[r:EXISTS_ON {
                    Actual_stock: $actual_stock,
                    Buy_date: date($buy_date),
                    Minimum_stock: $minimum_stock
                }]->(bo)
                RETURN type(r) as relationshipType, r
            `;
            params = { ...params, actual_stock, buy_date, minimum_stock };
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
        console.error("❌ Error al crear relación:", error);
        res.status(500).json({ message: "Error al crear relación.", error });
    } finally {
        await session.close();
    }
};

// Función que mapea source y target a un relationshipType
const getRelationshipType = (sourceType: string, targetType: string): string | null => {
    if (sourceType === "product" && targetType === "provider") {
        return "BELONGS_TO";
    }
    if (sourceType === "product" && targetType === "branchOffice") {
        return "EXISTS_ON";
    }
    return null;
};



