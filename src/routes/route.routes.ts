// src/routes/route.routes.ts
import { Router } from 'express';
import {
    createRoute,
    getAllRoutes,
    updateRoute,
    softDeleteRoute,
    mostLoadedRoute,
    longestTimeRoute,
    longestDistanceRoute,
    getRoutesByCompany
} from '../controllers/route.controller';

const router = Router();

// CRUD básico
router.post('/', createRoute);
router.get('/', getAllRoutes);
router.put('/:id', updateRoute);
router.delete('/:id', softDeleteRoute);

// Consultas especiales
router.get('/most-loaded', mostLoadedRoute);
router.get('/longest-time', longestTimeRoute);
router.get('/longest-distance', longestDistanceRoute);
router.get('/search/:company', getRoutesByCompany);

export default router;
