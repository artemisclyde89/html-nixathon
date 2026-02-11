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
  const ip =
    req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  const id = Date.now() + "-" + Math.random().toString(36).slice(2, 4);

  const newEvent = {
    id,
    type: "inbound",
    data: {
      method: req.method,
      path: req.originalUrl,
      headers: req.headers,
      query: req.query,
      body: req.body,
      ip: ip,
      timestamp: timestamp,
    },
    timestamp,
    receivedAt: new Date().toLocaleString(),
  };

  // Filter out SSE requests
  if (req.path === "/api/events/stream") {
    return next();
  }

  // Store and broadcast the inbound event
  recentEvents.push(newEvent);
  if (recentEvents.length > MAX_EVENTS) recentEvents.shift();

  res.locals.eventId = id; // attach id so we can link response later

  broadcastEvent({ type: "new_event", event: newEvent });

  // Capture response body/headers/status by wrapping write/end
  const chunks = [];
  const originalWrite = res.write;
  const originalEnd = res.end;

  res.write = function (chunk, encoding, callback) {
    try {
      if (chunk) chunks.push(Buffer.from(chunk));
    } catch (e) {
      // ignore
    }
    return originalWrite.apply(this, arguments);
  };

  res.end = function (chunk, encoding, callback) {
    try {
      if (chunk) chunks.push(Buffer.from(chunk));
    } catch (e) {
      // ignore
    }

    const body = Buffer.concat(chunks).toString("utf8");

    // Prepare response summary
    const responseSummary = {
      statusCode: res.statusCode,
      body: body,
      timestamp: new Date().toISOString(),
    };

    // Attach response to the matching inbound event if present
    const eventIndex = recentEvents.findIndex((e) => e.id === id);
    if (eventIndex !== -1) {
      const updatedEvent = recentEvents[eventIndex];
      updatedEvent.response = responseSummary;
      updatedEvent.lastUpdated = new Date().toLocaleString();
      recentEvents[eventIndex] = updatedEvent;

      // Broadcast an update so the UI can update the existing card
      broadcastEvent({ type: "status_update", event: updatedEvent });
    } else {
      // Fallback: create a standalone outbound event
      const outboundEvent = {
        id: id + "-out",
        type: "outbound",
        data: responseSummary,
        timestamp: responseSummary.timestamp,
        receivedAt: new Date().toLocaleString(),
      };
      recentEvents.push(outboundEvent);
      if (recentEvents.length > MAX_EVENTS) recentEvents.shift();
      broadcastEvent({ type: "new_event", event: outboundEvent });
    }

    return originalEnd.apply(this, arguments);
  };

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
