require('dotenv').config();

const express = require('express');
const aiRoutes = require('./src/routes/aiRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'kimure-ai-gateway'
  });
});

app.use('/ai', aiRoutes);

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

app.use((err, req, res, next) => {
  // Never print request bodies, provider responses, credentials, or identity data.
  console.error('[kimure:ai-gateway] request failed', {
    errorName: err && err.name ? err.name : 'Error'
  });
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`Kimure AI Gateway running on port ${PORT}`);
});
