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

  // Kingdom Wars Logging Requirement
  console.log("[KW-BOT] Mega ogudor");

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

app.get("/info", (req, res) => {
  res.json({
    name: "Mega ogudor",
    strategy: "AI-trapped-strategy",
    version: "1.0",
  });
});

app.post("/negotiate", (req, res) => {
  const { playerTower, enemyTowers } = req.body;

  // Simple Strategy: Propose peace with the weakest and target the strongest
  const sortedEnemies = [...enemyTowers].sort((a, b) => a.hp - b.hp);
  const weakest = sortedEnemies[0];
  const strongest = sortedEnemies[sortedEnemies.length - 1];

  if (weakest && strongest && weakest.playerId !== strongest.playerId) {
    return res.json([
      {
        allyId: weakest.playerId,
        attackTargetId: strongest.playerId,
      },
    ]);
  }

  res.json([]);
});

app.post("/combat", (req, res) => {
  const { playerTower, enemyTowers, previousAttacks } = req.body;
  let resources = playerTower.resources;
  const actions = [];

  // 1. Upgrade if possible (Highest priority for long term)
  // Formula: 50 * (1.75 ^ (level - 1))
  // We use Math.round() based on the examples (e.g. 50 * 1.75^2 = 153.125 -> 153)
  const upgradeCost = Math.round(50 * Math.pow(1.75, playerTower.level - 1));
  
  if (resources >= upgradeCost && playerTower.level < 6) {
    actions.push({ type: "upgrade" });
    resources -= upgradeCost;
  }

  // 2. Armor if being attacked or HP is low
  // Calculate incoming damage from *previous* turn to gauge threat
  const previousDamage = previousAttacks.reduce(
    (sum, atk) => (atk.action.targetId === playerTower.playerId ? sum + atk.action.troopCount : sum),
    0
  );

  // If we took damage last turn or are critical, build some armor
  if (previousDamage > 0 || playerTower.hp < 50) {
     // Cap armor spend to avoid draining everything, but ensure survival
    const maxArmor = Math.floor(resources / 1); // Cost is 1:1
    const armorAmount = Math.min(maxArmor, playerTower.hp < 30 ? 20 : 10);
    
    if (armorAmount > 0) {
      actions.push({ type: "armor", amount: armorAmount });
      resources -= armorAmount;
    }
  }

  // 3. Attack the most dangerous enemy with remaining resources
  if (resources > 0 && enemyTowers.length > 0) {
    // Target player with highest level (threat) or lowest HP (opportunity)
    // Priority: Kill low HP (< 50) -> Target high Level -> Target high HP
    const target = enemyTowers.sort((a, b) => {
        if (a.hp < 50 && b.hp >= 50) return -1;
        if (b.hp < 50 && a.hp >= 50) return 1;
        return b.level - a.level || a.hp - b.hp;
    })[0];

    // Ensure we have enough resources for at least 1 troop
    if (resources >= 1) {
        actions.push({
        type: "attack",
        targetId: target.playerId,
        troopCount: resources,
        });
        resources = 0;
    }
  }

  res.json(actions);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
