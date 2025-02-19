import { Request, Response } from 'express';
import { Neo4jDriverSingleton } from '../config/neo4j.config';
import { Record as Neo4jRecord } from 'neo4j-driver';

export const getNodes = async (req: Request, res: Response): Promise<void> => {
  const driver = Neo4jDriverSingleton.getInstance();
  const session = driver.session();

  try {
    const result = await session.run('MATCH (n) RETURN n LIMIT 10');
    const nodes = result.records.map((record: Neo4jRecord) => record.get('n'));
    res.json({ nodes });
  } catch (error) {
    console.error('Error al consultar Neo4j:', error);
    res.status(500).json({ error: 'Error al conectarse a Neo4j' });
  } finally {
    await session.close();
  }
};
