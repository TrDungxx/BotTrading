import express from 'express';
import cors from 'cors';
import indicatorRoutes from './routes/indicatorRoutes.js';
import orderRoutes from './routes/orderRoutes.js';

const app = express();

app.use(cors({
  origin: 'http://localhost:5174', // ✅ frontend đang chạy ở port 5174 (Vite)
  credentials: true               // ✅ Cho phép gửi cookie/session
}));

app.use(express.json());

app.use('/api/proxy/indicators', indicatorRoutes);
app.use('/api/proxy/orders', orderRoutes);

app.listen(5002, () => {
  console.log('Server running on port 5002'); // 👈 bạn đang lắng ở 5002 (sửa lại console log)
});
