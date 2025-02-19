// src/index.ts
import app from './app';
import { Neo4jDriverSingleton } from './config/neo4j.config';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Servidor Express corriendo en el puerto ${PORT}`);
});

// Manejo del cierre del driver al finalizar la aplicación
process.on('exit', async () => {
  await Neo4jDriverSingleton.closeDriver();
});
