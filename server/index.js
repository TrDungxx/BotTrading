
// ... phần code còn lại

const express = require('express');
const cors = require('cors');
const app = express();
const orderRoutes = require('./routes/orderRoutes');

app.use(cors());
app.use(express.json());
app.use('/api/orders', orderRoutes);

app.listen(5000, () => {
  console.log('✅ API server is running at http://localhost:5000');
});
