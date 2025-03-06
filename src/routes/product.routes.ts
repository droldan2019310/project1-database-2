import { Router } from 'express';
import { createProduct, getAllProducts, updateProduct, softDeleteProduct, mostPurchasedProduct, mostDistributedProduct, mostRequestedProductBetweenBranches, getProductRelationshipsById, createProductRelationship, getProductByName, createProductRelationshipProducts } 
from '../controllers/product.controller';

const router = Router();

router.post('/', createProduct);
router.get("/", (req, res) => {
    getAllProducts(req, res);
  });  
router.put('/:id', updateProduct);
router.delete('/:id', softDeleteProduct);
router.get('/name/:name', getProductByName);
router.post('/relationship', createProductRelationship);
router.post('/relationshipProducts', createProductRelationshipProducts);
router.get('/:id/relationships', getProductRelationshipsById);
router.get('/most-purchased', mostPurchasedProduct);
router.get('/most-distributed', mostDistributedProduct);
router.get('/most-requested', mostRequestedProductBetweenBranches);

export default router;
