import neo4j, { Driver } from 'neo4j-driver';

export class Neo4jDriverSingleton {
  private static instance: Driver;

  // Constructor privado para evitar instanciación externa
  private constructor() {}

  public static getInstance(): Driver {
    if (!Neo4jDriverSingleton.instance) {
      const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
      const user = process.env.NEO4J_USER || 'neo4j';
      const password = process.env.NEO4J_PASSWORD || 'tu_contraseña'; // Cambia esto o usa variables de entorno
      Neo4jDriverSingleton.instance = neo4j.driver(uri, neo4j.auth.basic(user, password));
    }
    return Neo4jDriverSingleton.instance;
  }

  public static async closeDriver(): Promise<void> {
    if (Neo4jDriverSingleton.instance) {
      await Neo4jDriverSingleton.instance.close();
      Neo4jDriverSingleton.instance = undefined as any;
    }
  }
}
