# Figma-Tinifier Server

Backend server for the Figma-Tinifier plugin. Compresses images using the Tinify (TinyPNG) API.

## Setup

1. Clone this repo
2. Copy `.env.example` to `.env` and add your Tinify API key
3. Install dependencies and start:

```bash
npm install
npm start
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TINIFY_API_KEY` | Your TinyPNG API key (get one at https://tinypng.com/developers) |
| `PORT` | Server port (default: 3000) |

## API Endpoints

### `GET /`
Health check endpoint. Returns server status.

### `GET /api/status`
Returns API key validation status and monthly compression count.

### `POST /api/compress`
Compress an image.

**Body (JSON):**
```json
{
  "image": "base64-encoded-image-data",
  "format": "png|jpeg|webp|avif",
  "width": 800,
  "height": 600
}
```

**Response:**
```json
{
  "success": true,
  "data": "base64-encoded-compressed-image",
  "originalSize": 102400,
  "compressedSize": 51200,
  "savings": 50,
  "compressionCount": 5
}
```

## Deploy to Railway

1. Push this repo to GitHub
2. Create new project on Railway from the GitHub repo
3. Add environment variable: `TINIFY_API_KEY`
4. Deploy - Railway will auto-detect Node.js

## License

MIT
