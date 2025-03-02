import { Router } from "express";
import { createInvoice, getInvoices, softDeleteInvoice, updateInvoice, getTopBranchesByInvoices } from "../controllers/invoice.controller";

const router = Router();

router.get("/", getInvoices);
router.post("/", createInvoice);
router.delete("/:id", softDeleteInvoice);
router.put("/:id", updateInvoice);
router.get("/top-branches", getTopBranchesByInvoices);

export default router;