import { Router } from "express";
import { createProvider, getProviders, getTopProvidersBySales, softDeleteProvider, updateProvider} from "../controllers/provider.controller";

const router = Router();

router.get("/", getProviders);
router.post("/", createProvider);
router.delete("/:id", softDeleteProvider);
router.put("/:id", updateProvider);
router.get("/top-providers", getTopProvidersBySales);

export default router;