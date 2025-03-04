// src/app.ts
import express from 'express';
import cors from 'cors'; // Importar CORS
import neo4jRoutes from './routes/neo4j.routes';
import productRoutes from './routes/product.routes';
import branchOfficeRoutes from './routes/branchOffice.routes';
import routeRoutes from './routes/route.routes';
import invoiceRoutes from './routes/invoice.routes';
import providerRoutes from './routes/provider.routes';
import uploadInfoRoutes from './routes/uploadInfo.routes';
import utilsRoutes from './routes/utils.routes';

const app = express();

// Middleware para habilitar CORS
app.use(cors());
// Middleware para parsear JSON
app.use(express.json());

// Usar las rutas importadas
app.use('/neo4j', neo4jRoutes);
app.use('/product', productRoutes);
app.use('/branchoffice', branchOfficeRoutes);
app.use('/route', routeRoutes);
app.use('/invoices', invoiceRoutes);
app.use('/providers', providerRoutes);
app.use('/Info', uploadInfoRoutes);
app.use('/utils', utilsRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).send('Ruta no encontrada');
});

export default app;
