import { Router } from 'express';
import { createProduct, getAllProducts, updateProduct, softDeleteProduct, mostPurchasedProduct, mostDistributedProduct, mostRequestedProductBetweenBranches, getProductRelationshipsById, createProductRelationship } 
from '../controllers/product.controller';

const router = Router();

router.post('/', createProduct);
router.get('/', getAllProducts);
router.put('/:id', updateProduct);
router.delete('/:id', softDeleteProduct);
router.post('/relationship', createProductRelationship);
router.get('/:id/relationships', getProductRelationshipsById);
router.get('/most-purchased', mostPurchasedProduct);
router.get('/most-distributed', mostDistributedProduct);
router.get('/most-requested', mostRequestedProductBetweenBranches);

export default router;
