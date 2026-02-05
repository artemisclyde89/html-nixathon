# Generic Event Dashboard

A simple, beautiful event receiver and dashboard that accepts **ANY JSON data** and displays it in real-time.

## 🚀 Quick Start

1. **Start the server:**
   ```bash
   node index.js
   ```

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
- **GET `/healthz`** - Health check endpoint

### Frontend (`public/`)
- Automatically polls the backend every 2 seconds
- Displays all received events in real-time
- Shows events in a beautiful, readable format
- Persists across page refreshes (stored in memory on server)

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
- ✅ **Real-time** - Auto-updates every 2 seconds
- ✅ **Beautiful UI** - Modern, dark theme with animations
- ✅ **Easy to understand** - Clear display of all received data
- ✅ **Configurable** - Change backend URL from the UI
- ✅ **Persistent** - Events stored in memory (last 100)

## 🔧 Configuration

### Change Backend URL
You can change the backend URL directly from the dashboard UI:
1. Enter the new URL in the input field
2. Click "Set"
3. The dashboard will reconnect automatically

### Adjust Polling Interval
Edit `public/app.js`:
```javascript
const POLLING_INTERVAL = 2000; // milliseconds
```

### Change Event Limit
Edit `index.js`:
```javascript
const MAX_EVENTS = 100; // number of events to keep
```

## 📦 Deployment

This app works on any platform:
- **Local** - Just run `node index.js`
- **Heroku** - Deploy as-is
- **DigitalOcean** - Works on any VPS
- **AWS/GCP/Azure** - Deploy to any cloud platform

**Note:** Events are stored in memory, so they will be lost on server restart. For production, consider adding a database.

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
