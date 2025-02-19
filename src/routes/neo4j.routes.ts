// src/routes/neo4j.routes.ts
import { Router } from 'express';
import { getNodes } from '../controllers/neo4j.controller';

const router = Router();

// Ruta para obtener nodos
router.get('/', getNodes);

export default router;
