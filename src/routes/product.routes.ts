import { Router } from 'express';
import { createProduct, getAllProducts, updateProduct, softDeleteProduct, mostPurchasedProduct, mostDistributedProduct, mostRequestedProductBetweenBranches } 
from '../controllers/product.controller';

const router = Router();

router.post('/', createProduct);
router.get('/', getAllProducts);
router.put('/:id', updateProduct);
router.delete('/:id', softDeleteProduct);

router.get('/most-purchased', mostPurchasedProduct);
router.get('/most-distributed', mostDistributedProduct);
router.get('/most-requested', mostRequestedProductBetweenBranches);

export default router;
