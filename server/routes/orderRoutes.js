// routes/orderRoutes.js
import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/getAllOrderHistory', async (req, res) => {
  try {
    const response = await axios.get(
      'https://9cc6-2402-800-61c3-79d3-f17f-1ad6-a8b5-8b66.ngrok-free.app/history/getAllOrderHistory',
      {
        params: req.query,
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ error: 'Failed to fetch order history' });
  }
});

export default router;
