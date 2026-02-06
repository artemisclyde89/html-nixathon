# Generic Event Dashboard

A simple, beautiful event receiver and dashboard that accepts **ANY JSON data** and displays it in real-time.

## 🚀 Quick Start

1. **Start the server:**
   ```bash
   npm run dev
   ```
   *(Uses nodemon to automatically restart on changes)*

2. **Open the dashboard:**
   Open `http://localhost:8000` in your browser

3. **Send events:**
   ```bash
   curl -X POST http://localhost:8000/api/events \
     -H "Content-Type: application/json" \
     -d '{"your": "data", "goes": "here"}'
   ```

## 📡 How It Works

### Backend (`index.js`)
- **POST `/api/events`** - Accepts ANY JSON payload
- **GET `/api/events`** - Returns recent events (last 100)
- **GET `/api/events/stream`** - Real-time SSE (Server-Sent Events) endpoint

### Frontend (`public/`)
- Uses **Server-Sent Events (SSE)** for instant, real-time updates (no polling)
- Displays all received events in real-time
- Shows events in a beautiful, readable format
- **Persists history** in your browser's local storage automatically

## 💡 Usage Examples

### Example 1: User Data
```bash
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","age":25,"city":"New York"}'
```

### Example 2: Order Data
```bash
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{"order_id":"12345","product":"Widget","quantity":10,"price":99.99}'
```

### Example 3: Array of Objects
```bash
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -d '[{"name":"Bob","age":30},{"name":"Charlie","age":35}]'
```

### Example 4: Nested Objects
```bash
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{"user":{"name":"Dave","email":"dave@example.com"},"action":"login","timestamp":"2026-02-05T20:00:00Z"}'
```

## 🎨 Features

- ✅ **Generic** - Accepts any JSON structure
- ✅ **Real-time** - Uses Server-Sent Events (SSE) for instant pushes
- ✅ **Beautiful UI** - Modern, dark theme with animations
- ✅ **Easy to understand** - Clear display of all received data
- ✅ **Configurable** - Change backend URL from the UI or `.env`
- ✅ **Persistent** - History is saved in your browser's local storage (survives restarts)

## 🔧 Configuration

### Change Backend Configuration
The app now uses a `.env` file for backend configuration:
1. Copy the values from `.env` (or create a new one)
2. Set `PORT` for the server port
3. Set `EXTERNAL_API_URL` to define where events are forwarded

### UI Backend URL
You can also change the backend URL directly from the dashboard:
1. Enter the new URL in the input field
2. Click "Set"
3. The dashboard remembers this setting in LocalStorage. If the frontend is on the same host as the backend, it will auto-detect the URL.

### Real-time Streaming
The app uses SSE. If you change the backend location in the UI, the frontend will automatically close the old stream and open a new one to the new target.

### Change Event Limit
Edit `index.js`:
```javascript
const MAX_EVENTS = 100; // number of events to keep
```

## 📦 Deployment

This app works on any platform:
- **Local** - Run `npm run dev`
- **PaaS (Heroku/Railway/Render)** - Deploy the repo; the server will auto-pick the `PORT` and the frontend will auto-detect the `API_URL`.

**Note:** While events are persisted in the browser's LocalStorage, the server-side memory list resets on restart. For long-term server-side storage, consider adding a database.

## 🛠️ Tech Stack

- **Backend:** Express.js
- **Frontend:** Vanilla JavaScript
- **Styling:** Modern CSS with glassmorphism
- **Fonts:** Inter (Google Fonts)

## 📝 API Reference

### POST /api/events
Accepts any JSON payload and stores it with metadata.

**Request:**
```json
{
  "any": "data",
  "you": "want"
}
```

**Response:**
```json
{
  "status": "received",
  "event": {
    "data": { "any": "data", "you": "want" },
    "timestamp": "2026-02-05T20:37:12.864Z",
    "receivedAt": "2/5/2026, 9:37:12 PM"
  }
}
```

### GET /api/events
Returns all recent events (last 100).

**Response:**
```json
[
  {
    "data": { "your": "data" },
    "timestamp": "2026-02-05T20:37:12.864Z",
    "receivedAt": "2/5/2026, 9:37:12 PM"
  }
]
```

## 🎯 Use Cases

- **Webhook receiver** - Test webhooks from any service
- **Event monitoring** - Monitor events from your applications
- **Data debugging** - See what data is being sent
- **API testing** - Test API integrations
- **Learning** - Understand JSON data structures

WE WILL WIN
