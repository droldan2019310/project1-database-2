import { Router } from "express";
import { createInvoice, getInvoices, softDeleteInvoice, updateInvoice, getTopBranchesByInvoices, createBuyOrder, getInvoicesByCashier, createRelationshipInvoice } from "../controllers/invoice.controller";

const router = Router();

router.get("/", getInvoices);
router.post("/", createInvoice);
router.post('/buyorder', createBuyOrder);
router.post('/relationship', createRelationshipInvoice);
router.get('/search/:cashier_main', getInvoicesByCashier);
router.delete("/:id", softDeleteInvoice);
router.put("/:id", updateInvoice);
router.get("/top-branches", getTopBranchesByInvoices);

export default router;