require('dotenv').config();
const express = require('express');
const cors = require('cors');
const tinify = require('tinify');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Multer for binary uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  exposedHeaders: ['X-Original-Size', 'X-Compressed-Size', 'X-Savings', 'X-Compression-Count']
}));
app.use(express.json({ limit: '50mb' }));

// Health check endpoint for Railway
app.get('/', (req, res) => {
  res.json({
    service: 'Figma-Tinifier',
    status: 'running',
    version: '1.0.0'
  });
});

// Initialize Tinify with API key
const apiKey = process.env.TINIFY_API_KEY;
if (!apiKey) {
  console.error('Error: TINIFY_API_KEY not set in .env file');
  process.exit(1);
}
tinify.key = apiKey;

// GET /api/status - Check server status and validate API key
app.get('/api/status', async (req, res) => {
  try {
    await tinify.validate();
    res.json({
      status: 'ok',
      compressionCount: tinify.compressionCount || 0,
      message: 'API key validated successfully'
    });
  } catch (error) {
    res.status(401).json({
      status: 'error',
      error: 'Invalid API key',
      message: error.message
    });
  }
});

// POST /api/compress - Compress an image (base64 - legacy)
app.post('/api/compress', async (req, res) => {
  try {
    const { image, format, width, height, background } = req.body;

    if (!image) {
      return res.status(400).json({
        error: 'Missing image data',
        message: 'Please provide base64-encoded image data'
      });
    }

    // Decode base64 image
    const imageBuffer = Buffer.from(image, 'base64');

    const result = await compressImage(imageBuffer, { format, width, height, background });

    // Return base64-encoded result
    res.json({
      success: true,
      data: result.buffer.toString('base64'),
      originalSize: imageBuffer.length,
      compressedSize: result.buffer.length,
      savings: Math.round((1 - result.buffer.length / imageBuffer.length) * 100),
      compressionCount: tinify.compressionCount
    });

  } catch (error) {
    handleCompressionError(error, res);
  }
});

// POST /api/compress/binary - Compress an image (binary - faster)
app.post('/api/compress/binary', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Missing image data',
        message: 'Please provide image file'
      });
    }

    const { format, width, height, background } = req.body;
    const imageBuffer = req.file.buffer;

    const result = await compressImage(imageBuffer, { format, width, height, background });

    // Return binary response
    res.set({
      'Content-Type': `image/${result.format}`,
      'X-Original-Size': imageBuffer.length.toString(),
      'X-Compressed-Size': result.buffer.length.toString(),
      'X-Savings': Math.round((1 - result.buffer.length / imageBuffer.length) * 100).toString(),
      'X-Compression-Count': (tinify.compressionCount || 0).toString()
    });
    res.send(result.buffer);

  } catch (error) {
    handleCompressionError(error, res);
  }
});

// Shared compression logic
async function compressImage(imageBuffer, options) {
  const { format, width, height, background } = options;

  let source = tinify.fromBuffer(imageBuffer);
  let result = source;

  // Apply resize if dimensions provided
  if (width || height) {
    result = result.resize({
      method: 'fit',
      width: width ? parseInt(width) : 9999,
      height: height ? parseInt(height) : 9999
    });
  }

  // Apply format conversion if not PNG
  const outputFormat = format || 'png';
  if (outputFormat !== 'png') {
    result = result.convert({ type: `image/${outputFormat === 'jpg' ? 'jpeg' : outputFormat}` });
  }

  // Add background for formats that don't support transparency
  if (outputFormat === 'jpeg' || outputFormat === 'jpg') {
    result = result.transform({ background: background || 'white' });
  }

  const compressedBuffer = await result.toBuffer();
  return { buffer: compressedBuffer, format: outputFormat };
}

// Shared error handling
function handleCompressionError(error, res) {
  console.error('Compression error:', error);

  if (error.status === 401) {
    return res.status(401).json({
      error: 'Invalid API key',
      message: 'Check your TINIFY_API_KEY in .env file'
    });
  }
  if (error.status === 429) {
    return res.status(429).json({
      error: 'Rate limited',
      message: 'Monthly compression limit reached (500 for free tier)'
    });
  }

  res.status(500).json({
    error: 'Compression failed',
    message: error.message
  });
}

// Start server (listen on 0.0.0.0 for Railway/Docker)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Figma-Tinifier server running on port ${PORT}`);
  console.log('Validating API key...');

  tinify.validate()
    .then(() => {
      console.log('API key validated successfully');
      console.log(`Compressions used this month: ${tinify.compressionCount || 0}/500`);
    })
    .catch((error) => {
      console.error('API key validation failed:', error.message);
    });
});
