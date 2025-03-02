// src/app.ts
import express from 'express';
import neo4jRoutes from './routes/neo4j.routes';

const app = express();

// Middleware para parsear JSON
app.use(express.json());

// Usar las rutas importadas
app.use('/neo4j', neo4jRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).send('Ruta no encontrada');
});

export default app;
