import { Router } from "express";
import { UtilsController} from "../controllers/utils.controller";

const router = Router();

// 📌 Definimos la ruta para contar nodos por tipo
router.get("/:nodeType", UtilsController.countNodes);

export default router;
