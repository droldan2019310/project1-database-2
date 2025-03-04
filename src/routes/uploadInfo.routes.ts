import { Router } from "express";
import { UploadInfoController } from "../controllers/uploadInfo.controller";
import { upload } from "../middlewares/uploadInfo.middleware";

const router = Router();

router.post("/upload-csv", upload.single("file"), UploadInfoController.uploadCSV);

export default router;