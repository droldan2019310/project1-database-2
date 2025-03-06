import { Router } from 'express';
import {
    createBranchOffice,
    getAllBranchOffices,
    updateBranchOffice,
    softDeleteBranchOffice,
    top5BranchesWithMostSales,
    branchesNeedingBetterDistribution,
    topProductsPerBranch,
    createRelationshipBranch
} from '../controllers/branchOffice.controller';

const router = Router();

// CRUD Básico
router.post('/', createBranchOffice);
router.get('/', getAllBranchOffices);
router.put('/:id', updateBranchOffice);
router.delete('/:id', softDeleteBranchOffice);
router.post('/relationship', createRelationshipBranch);

// Consultas Especiales
router.get('/top-sales', top5BranchesWithMostSales);
router.get('/needs-distribution', branchesNeedingBetterDistribution);
router.get('/:id/top-products', topProductsPerBranch);

export default router;
