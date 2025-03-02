import multer from "multer";

// Configuración para almacenar archivos en memoria (en lugar de disco)
const storage = multer.memoryStorage();
export const upload = multer({ storage });