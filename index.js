require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 8000;
let recentEvents = [];
const MAX_EVENTS = 100;
let clients = [];

const RESOURCE_BASE = 20;
const RESOURCE_MULTIPLIER = 1.5;
const UPGRADE_BASE_COST = 50;
const UPGRADE_COST_MULTIPLIER = 1.75;
const FATIGUE_START_TURN = 25;
const ESTIMATED_GAME_END = 35;

// ─── UTILITY FUNCTIONS ─────────────────────────────────────
function getResourcesPerTurn(level) {
  return Math.ceil(RESOURCE_BASE * Math.pow(RESOURCE_MULTIPLIER, level - 1));
}
function getUpgradeCost(level) {
  return Math.ceil(
    UPGRADE_BASE_COST * Math.pow(UPGRADE_COST_MULTIPLIER, level - 1),
  );
}
function threatScore(tower) {
  return tower.hp + (tower.armor || 0) + tower.level * 20;
}
function survivability(tower) {
  return tower.hp + (tower.armor || 0);
}

// ─── ECONOMY ENGINE ─────────────────────────────────────────
function shouldUpgrade(level, resources, turn, isUnderAttack) {
  const cost = getUpgradeCost(level);
  // Aggressive upgrade if safe
  if (!isUnderAttack) {
      return resources >= cost;
  }
  
  // If under attack, only upgrade if we have significant surplus or ROI is amazing
  if (resources > cost * 1.5) return true;

  return false;
}
function getGamePhase(turn, level) {
  if (level < 3) return "EARLY";
  if (level >= 3 && turn <= 18) return "MID";
  return "LATE";
}
function getBudgetAllocation(phase, turn, hp, armor) {
  // Returns { offense, defense, savings } as fractions
  const SAFE_ARMOR_THRESHOLD = 50;
  
  // Emergency: critical HP or low armor
  if (hp <= 30 || armor < 10) {
    return { offense: 0.0, defense: 0.9, savings: 0.1 };
  }

  // If armor is not topped up, prioritize it heavily
  if (armor < SAFE_ARMOR_THRESHOLD) {
      if (phase === "EARLY") return { offense: 0.0, defense: 0.8, savings: 0.2 };
      return { offense: 0.1, defense: 0.8, savings: 0.1 };
  }

  // If we are safe (high armor), focus on savings/upgrades
  switch (phase) {
    case "EARLY":
      return { offense: 0.0, defense: 0.2, savings: 0.8 }; // save max for upgrades
    case "MID":
      return { offense: 0.2, defense: 0.4, savings: 0.4 };
    case "LATE":
      if (turn >= FATIGUE_START_TURN) {
        return { offense: 0.4, defense: 0.6, savings: 0.0 }; // turtle up + some damage
      }
      return { offense: 0.3, defense: 0.5, savings: 0.2 };
    default:
      return { offense: 0.1, defense: 0.5, savings: 0.4 };
  }
}
// ─── TARGET SELECTION ───────────────────────────────────────
function selectTarget(enemies, previousAttacks, diplomacy, budget) {
  const myAttackers = new Set();
  if (previousAttacks) {
    for (const atk of previousAttacks) {
      myAttackers.add(atk.playerId);
    }
  }
  const alliedIds = new Set();
  if (diplomacy) {
    for (const d of diplomacy) {
      if (d.action && d.action.allyId) {
        alliedIds.add(d.playerId);
      }
    }
  }
  let bestTarget = null;
  let bestScore = -Infinity;
  for (const enemy of enemies) {
    let score = 0;
    // Weakness score — lower survivability = easier kill
    score += (200 - survivability(enemy)) * 2;
    // Revenge — they attacked us, hit them back
    if (myAttackers.has(enemy.playerId)) {
      score += 50;
    }
    // Threat level — high level enemies are dangerous
    score += enemy.level * 15;
    // Kill potential — can we finish them this turn?
    if (survivability(enemy) <= budget) {
      score += 100;
    }
    // Close to death bonus
    if (enemy.hp <= 25) {
      score += 80;
    }
    // Diplomatic consideration — slight penalty for attacking allies who didn't betray us
    if (alliedIds.has(enemy.playerId) && !myAttackers.has(enemy.playerId)) {
      score -= 40;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTarget = enemy;
    }
  }
  return bestTarget;
}
// ─── NEGOTIATION STRATEGY ───────────────────────────────────
function negotiate(state) {
  const { playerTower, enemyTowers: apiEnemeyTowers, combatActions } = state;
  const enemyTowers = apiEnemeyTowers.filter(({hp}) => hp > 0)
  if (!enemyTowers || enemyTowers.length === 0) return [];
  // Identify who attacked us last combat

  if (enemyTowers.length === 1) {
    // If only one enemy is left, don't tell them to attack anyone (or attack a ghost ID)
    // Better yet: just return the alliance without a target
    return [
      {
        allyId: enemyTowers[0].playerId,
      },
    ];
  }
  const attackersOnMe = new Set();
  if (combatActions) {
    for (const ca of combatActions) {
      if (ca.action && ca.action.targetId === playerTower.playerId) {
        attackersOnMe.add(ca.playerId);
      }
    }
  }
  // Sort enemies by threat score
  const sorted = [...enemyTowers].sort(
    (a, b) => threatScore(b) - threatScore(a),
  );
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const myThreat = threatScore(playerTower);
  const iAmStrongest = myThreat >= threatScore(strongest);
  let allyId, attackTargetId;
  // if (iAmStrongest) {
  //   // I'm the strongest: ally with the weakest, gang up on the middle
  //   allyId = weakest.playerId;
  //   attackTargetId = sorted.length > 1 ? sorted[Math.floor(sorted.length / 2)].playerId : undefined;
  // } else {
  //   // Ally with the strongest (non-attacker if possible)
  //   const nonAttackers = sorted.filter((e) => !attackersOnMe.has(e.playerId));
  //   const allyCandidate = nonAttackers.length > 0 ? nonAttackers[0] : strongest;
  //   allyId = allyCandidate.playerId;
  //   // Point the ally at our biggest threat (someone else)
  //   const threats = sorted.filter((e) => e.playerId !== allyId);
  //   attackTargetId = threats.length > 0 ? threats[0].playerId : undefined;
  // }
  // Don't ally with someone who attacked us
  // if (attackersOnMe.has(allyId) && enemyTowers.length > 1) {
  //   const alternative = enemyTowers.find(
  //     (e) => e.playerId !== allyId && !attackersOnMe.has(e.playerId)
  //   );
  //   if (alternative) {
  //     allyId = alternative.playerId;
  //   }
  // }

  const negotiations = enemyTowers.map((enemy) => {
    let targetId;

    // STRATEGY:
    // If we are talking to the Weakest, set them up to die against the Strongest.
    // If we are talking to anyone else, tell them to crush the Weakest.
    if (enemy.playerId === weakest.playerId) {
      targetId = strongest.playerId;
    } else {
      targetId = weakest.playerId;
    }

    return {
      allyId: enemy.playerId, // "I am your friend"
      attackTargetId: targetId, // "Go attack this guy"
    };
  });
  return negotiations;
}
// ─── COMBAT STRATEGY ────────────────────────────────────────
function combat(state) {
  const { playerTower, enemyTowers: apiEnemyTowers, diplomacy, previousAttacks, turn } = state;
  const enemyTowers = apiEnemyTowers.filter(({hp}) => hp > 0)
  const actions = [];
  let budget = playerTower.resources;
  const phase = getGamePhase(turn, playerTower.level);
  const level = playerTower.level;
  
  // --- FIRST TURN LOGIC ---
  if (turn === 0) {
      if (budget >= 2) {
          actions.push({ type: "armor", amount: 2 });
          budget -= 2;
      }
      const targets = enemyTowers.filter(t => t.playerId !== playerTower.playerId);
      for (const target of targets) {
          if (budget < 1) break;
          const damage = Math.floor(Math.random() * 3) + 1;
          const actualDamage = Math.min(damage, budget);
          actions.push({ type: "attack", targetId: target.playerId, troopCount: actualDamage });
          budget -= actualDamage;
      }
      return actions;
  }

  // --- Detect if we're under attack ---
  let incomingDamage = 0;
  if (previousAttacks) {
    for (const atk of previousAttacks) {
      if (atk.action && atk.action.targetId === playerTower.playerId) {
        incomingDamage += atk.action.troopCount || 0;
      }
    }
  }
  const isUnderAttack = incomingDamage > 0;

  // --- PRIORITY: UPGRADE FIRST (IF SAFE) ---
  if (!isUnderAttack) {
      if (shouldUpgrade(level, budget, turn, isUnderAttack)) {
        const cost = getUpgradeCost(level);
        actions.push({ type: "upgrade" });
        budget -= cost;
      }
  }

  // --- PRIORITY: ARMOR (DYNAMIC THRESHOLD) ---
  // Calculate dynamic threshold: don't be the weakest tower
  // const SAFE_ARMOR_THRESHOLD = level >= 2 ? 35 : 15; // Old static logic
  const mySurvivability = survivability(playerTower);
  const enemySurvivabilities = enemyTowers.map(e => survivability(e));
  const minEnemySurvivability = enemySurvivabilities.length > 0
      ? Math.min(...enemySurvivabilities)
      : 0;
  // We want our total survivability (hp + armor) to be above the weakest enemy
  // so we are never classified as the weakest target
  const targetSurvivability = minEnemySurvivability + 5; // small buffer above weakest
  const neededForThreshold = Math.max(0, targetSurvivability - mySurvivability);
  // Fallback minimum: at least keep some armor baseline
  const SAFE_ARMOR_THRESHOLD = Math.max(neededForThreshold, level >= 2 ? 20 : 10);

  let desiredArmor = SAFE_ARMOR_THRESHOLD;
  // If we already have enough armor above threshold, desiredArmor is 0
  if (playerTower.armor >= SAFE_ARMOR_THRESHOLD) {
      desiredArmor = 0;
  } else {
      desiredArmor = SAFE_ARMOR_THRESHOLD - playerTower.armor;
  }
  
  if (isUnderAttack) {
      desiredArmor += incomingDamage;
  }

  let armorSpend = Math.min(desiredArmor, budget);
  if (armorSpend > 0) {
      actions.push({ type: "armor", amount: armorSpend });
      budget -= armorSpend;
  }

  // --- TRICKLE ARMOR: keep accumulating even after threshold ---
  // Spend ~10% of remaining budget on extra armor to keep growing over time
  if (budget > 0 && desiredArmor === 0) {
      const trickleArmor = Math.max(1, Math.floor(budget * 0.1));
      actions.push({ type: "armor", amount: trickleArmor });
      budget -= trickleArmor;
  }

  // --- PRIORITY: UPGRADE SECOND (IF UNDER ATTACK) ---
  if (isUnderAttack) {
      if (shouldUpgrade(level, budget, turn, isUnderAttack)) {
        const cost = getUpgradeCost(level);
        actions.push({ type: "upgrade" });
        budget -= cost;
      }
  }

  /* OLD LOGIC PRESERVED AS COMMENTS
  // --- ARMOR FIRST (ALWAYS TOP UP) ---
  const SAFE_ARMOR_THRESHOLD = 50;
  let desiredArmor = SAFE_ARMOR_THRESHOLD - playerTower.armor;
  if (desiredArmor < 0) desiredArmor = 0;
  
  // If under attack, add incoming damage to desired armor
  if (isUnderAttack) {
      desiredArmor += incomingDamage;
  }

  // Cap armor spend by budget
  let armorSpend = Math.min(desiredArmor, budget);
  
  // Execute Armor
  if (armorSpend > 0) {
      actions.push({ type: "armor", amount: armorSpend });
      budget -= armorSpend;
  }

  // --- UPGRADE SECOND ---
  // Only upgrade if we have satisfied immediate safety needs
  if (shouldUpgrade(level, budget, turn, isUnderAttack)) {
    const cost = getUpgradeCost(level);
    actions.push({ type: "upgrade" });
    budget -= cost;
  }
  */
  // --- BUDGET ALLOCATION ---
  // const allocation = getBudgetAllocation(
  //   phase,
  //   turn,
  //   playerTower.hp,
  //   playerTower.armor,
  // );
  // // --- ARMOR DECISION ---
  // let armorBudget = Math.floor(budget * allocation.defense);
  // // If under attack, at least match incoming damage
  // if (isUnderAttack) {
  //   armorBudget = Math.max(armorBudget, Math.min(incomingDamage, budget));
  // }
  // // Pre-fatigue armor burst
  // if (
  //   turn >= FATIGUE_START_TURN - 2 &&
  //   turn < FATIGUE_START_TURN &&
  //   playerTower.armor < 40
  // ) {
  //   armorBudget = Math.max(
  //     armorBudget,
  //     Math.min(Math.floor(budget * 0.5), budget),
  //   );
  // }
  // armorBudget = Math.min(armorBudget, budget);
  // if (armorBudget > 0) {
  //   actions.push({ type: "armor", amount: armorBudget });
  //   budget -= armorBudget;
  // }
  // --- ATTACK DECISION ---
  if (!enemyTowers || enemyTowers.length === 0) return actions;
  
  /* OLD LOGIC PRESERVED AS COMMENTS
  // Check for killable targets first — always go for the kill
  const killable = enemyTowers.filter((e) => survivability(e) <= budget);
  if (killable.length > 0) {
    // Kill the one with highest threat
    killable.sort((a, b) => threatScore(b) - threatScore(a));
    const killTarget = killable[0];
    const troopsNeeded = survivability(killTarget);
    actions.push({
      type: "attack",
      targetId: killTarget.playerId,
      troopCount: troopsNeeded,
    });
    budget -= troopsNeeded;
  }
  // Spend remaining attack budget on primary target (if we haven't already attacked them)
  const alreadyAttacked = new Set(
    actions.filter((a) => a.type === "attack").map((a) => a.targetId),
  );
  if (budget > 5) {
    const target = selectTarget(
      enemyTowers,
      previousAttacks,
      diplomacy,
      budget,
    );
    if (target && !alreadyAttacked.has(target.playerId)) {
      const attackBudget =
        phase === "EARLY" ? Math.floor(budget * 0.3) : budget;
      if (attackBudget > 0) {
        actions.push({
          type: "attack",
          targetId: target.playerId,
          troopCount: attackBudget,
        });
        budget -= attackBudget;
      }
    }
  }
  */

  // --- NEW ATTACK LOGIC ---
  let attackBudget = budget; // Use whatever is left

  if (level >= 3) {
      attackBudget = Math.min(attackBudget, Math.floor(playerTower.resources * 0.3));
  }

  // If not under attack and armor is good, maybe save some for next turn upgrade?
  if (!isUnderAttack && playerTower.armor >= SAFE_ARMOR_THRESHOLD) {
      // Keep some savings if we are close to next upgrade
      const nextUpgradeCost = getUpgradeCost(level);
      if (budget < nextUpgradeCost && budget > nextUpgradeCost * 0.5) {
          attackBudget = 0; // Save it all
      }
  }

  if (attackBudget > 5) {
      // Prioritize retaliating against attackers
      let targetId = null;
      if (isUnderAttack && previousAttacks) {
          const attacker = previousAttacks.find(a => a.action && a.action.targetId === playerTower.playerId);
          if (attacker) targetId = attacker.playerId;
      }

      // If no attacker or we killed them, pick weakest
      if (!targetId) {
           // Only attack if we are really rich or it's late game
           if (phase === "LATE" || attackBudget > 30) {
                const weakest = enemyTowers.sort((a,b) => survivability(a) - survivability(b))[0];
                targetId = weakest.playerId;
           }
      }

      if (targetId) {
        actions.push({
            type: "attack",
            targetId: targetId,
            troopCount: attackBudget
        });
        budget -= attackBudget;
      }
  }

  return actions;
}

// Update this to your target API URL via .env file
const EXTERNAL_API_URL =
  process.env.EXTERNAL_API_URL || "https://httpbin.org/post";

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

app.post("/negotiate", (req, res) => {
  try {
    const result = negotiate(req.body);
    res.json(result);
  } catch (err) {
    console.error("Negotiation error:", err.message);
    res.json([]);
  }
});
// Combat phase
app.post("/combat", (req, res) => {
  try {
    const result = combat(req.body);
    res.json(result);
  } catch (err) {
    console.error("Combat error:", err.message);
    res.json([]);
  }
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
