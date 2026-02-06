require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 8000;
let recentEvents = [];
const MAX_EVENTS = 100;
let clients = [];

app.use(cors({ origin: "*" }));
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: "*/*" }));
app.use(express.static("public"));
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  const newEvent = {
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 4),
    type: "inbound",
    data: {
      method: req.method,
      path: req.originalUrl,
      headers: req.headers,
      query: req.query,
      body: req.body,
      ip: ip,
      timestamp: timestamp
    },
    timestamp,
    receivedAt: new Date().toLocaleString(),
  };

  recentEvents.push(newEvent);
  if (recentEvents.length > MAX_EVENTS) recentEvents.shift();

  // stop broadcasting SSE requests
  const isSSE = req.path === "/api/events/stream";
  if (!isSSE) {
    broadcastEvent({ type: "new_event", event: newEvent });
  }

  next();
});

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
  res.status(200).json({ status: "received" });
});

app.post("/api/webhook", (req, res) => {
  console.log("📬 Received webhook data");
  res.status(200).json({ status: "received" });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
