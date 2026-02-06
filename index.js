require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 8000;
let recentEvents = [];
const MAX_EVENTS = 100;
let clients = [];

// Update this to your target API URL via .env file
const EXTERNAL_API_URL =
  process.env.EXTERNAL_API_URL || "https://httpbin.org/post";

app.use(cors({ origin: "*" }));
app.set("trust proxy", 1); // Trust first proxy (useful for Heroku/Render/Railway)
app.use((req, res, next) => {
  const payload = req.body;
  const timestamp = new Date().toISOString();

  const newEvent = {
    id: Date.now() + "-" + Math.random().toString(36).substr(2, 4),
    type: "inbound",
    url: `${req.method}: ${req.path}`,
    data: payload,
    timestamp: timestamp,
    receivedAt: new Date().toLocaleString(),
  };

  recentEvents.push(newEvent);
  if (recentEvents.length > MAX_EVENTS) recentEvents.shift();

  broadcastEvent({ type: "new_event", event: newEvent });
  return next();
});
app.use(express.json());
app.use(express.static("public"));

function broadcastEvent(event) {
  clients.forEach((client) => {
    client.res.write(`data: ${JSON.stringify(event)}\n\n`);
  });
}

app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "OK" });
});

app.get("/api/events", (req, res) => {
  res.json(recentEvents);
});

app.get("/api/events/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  clients.push(newClient);

  req.on("close", () => {
    clients = clients.filter((c) => c.id !== clientId);
  });
});

app.post("/api/events", (req, res) => {
  const payload = req.body;
  const timestamp = new Date().toISOString();

  const newEvent = {
    id: Date.now() + "-" + Math.random().toString(36).substr(2, 4),
    type: "outbound",
    data: payload,
    timestamp: timestamp,
    receivedAt: new Date().toLocaleString(),
    forwarding: { status: "pending", target: EXTERNAL_API_URL },
  };

  recentEvents.push(newEvent);
  if (recentEvents.length > MAX_EVENTS) recentEvents.shift();

  broadcastEvent({ type: "new_event", event: newEvent });

  console.log(`📤 Forwarding event to ${EXTERNAL_API_URL}...`);

  fetch(EXTERNAL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(async (response) => {
      newEvent.forwarding.status = response.ok ? "success" : "failed";
      newEvent.forwarding.statusCode = response.status;
      console.log(`✅ Forwarded successfully: ${response.status}`);
      broadcastEvent({ type: "status_update", event: newEvent });
    })
    .catch((error) => {
      newEvent.forwarding.status = "error";
      newEvent.forwarding.error = error.message;
      console.error(`❌ Forwarding failed:`, error.message);
      broadcastEvent({ type: "status_update", event: newEvent });
    });

  res.status(201).json({ status: "received", event: newEvent });
});

app.post("/api/webhook", (req, res) => {
  const payload = req.body;
  const timestamp = new Date().toISOString();

  const newEvent = {
    id: Date.now() + "-" + Math.random().toString(36).substr(2, 4),
    type: "webhook",
    data: payload,
    timestamp: timestamp,
    receivedAt: new Date().toLocaleString(),
  };

  recentEvents.push(newEvent);
  if (recentEvents.length > MAX_EVENTS) recentEvents.shift();

  broadcastEvent({ type: "new_event", event: newEvent });

  console.log("📬 Received webhook data from external API");
  res.status(200).json({ status: "received" });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
