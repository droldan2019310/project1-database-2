import { Router } from "express";
import { createProvider, createProviderRelationship, getProviders, getTopProvidersBySales, searchProviderByName, softDeleteProvider, updateProvider} from "../controllers/provider.controller";

const router = Router();

router.get("/", getProviders);
router.get("/search/:name", searchProviderByName);
router.post('/relationshipProvider', createProviderRelationship);
router.post("/", createProvider);
router.delete("/:id", softDeleteProvider);
router.put("/:id", updateProvider);
router.get("/top-providers", getTopProvidersBySales);

export default router;