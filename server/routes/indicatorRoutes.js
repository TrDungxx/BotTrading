// server/routes/indicatorRoutes.js
import express from 'express';
import axios from 'axios';

const router = express.Router();
const TARGET_API = 'https://9cc6-2402-800-61c3-79d3-f17f-1ad6-a8b5-8b66.ngrok-free.app/m-sys/indicators';

router.get('/', async (req, res) => {
  try {
    const response = await axios.get(TARGET_API);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch indicators' });
  }
});

router.post('/create', async (req, res) => {
  try {
    const response = await axios.post(`${TARGET_API}/create`, req.body);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create indicator' });
  }
});

router.put('/update', async (req, res) => {
  try {
    const response = await axios.put(`${TARGET_API}/update`, req.body);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update indicator' });
  }
});

router.delete('/delete', async (req, res) => {
  try {
    const response = await axios.delete(`${TARGET_API}/delete`, { data: req.body });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete indicator' });
  }
});

export default router;
