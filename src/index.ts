// src/index.ts
import app from './app';
import { Neo4jDriverSingleton } from './config/neo4j.config';
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Inicializar la conexión a Neo4j
    const driver = Neo4jDriverSingleton.getInstance();
    await driver.verifyConnectivity(); // Verifica que la conexión es válida
    console.log('✅ Conexión exitosa a Neo4j');

    // Levantar el servidor Express
    const server = app.listen(PORT, () => {
      console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}`);
    });

    // Manejo de cierre limpio
    process.on('SIGINT', async () => {
      console.log('🛑 Cerrando aplicación...');
      await Neo4jDriverSingleton.closeDriver();
      server.close(() => {
        console.log('👋 Servidor Express detenido.');
        process.exit(0);
      });
    });

    process.on('exit', async () => {
      await Neo4jDriverSingleton.closeDriver();
    });

  } catch (error) {
    console.error('❌ Error al conectar con Neo4j:', error);
    process.exit(1); // Detiene la aplicación si no logra conectar
  }
}

startServer();
