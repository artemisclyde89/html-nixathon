import { generateVisualizations } from "./js/visualizers.js";
import * as storage from "./js/storage.js";

const isLocalDev =
  window.location.port === "5503" ||
  window.location.port === "5501" ||
  window.location.port === "5500";
let API_URL = isLocalDev ? "http://localhost:8000" : window.location.origin;

/* ... DOM Elements ... */
const container = document.getElementById("events-container");
const connectionStatus = document.getElementById("connection-status");
const apiUrlInput = document.getElementById("api-url");
const updateUrlBtn = document.getElementById("update-url-btn");
const jsonInput = document.getElementById("json-input");
const sendJsonBtn = document.getElementById("send-json-btn");
const inputStatus = document.getElementById("input-status");

let processedEventCount = 0;
let eventSource = null;

// Initialize
function init() {
  loadLocalEvents();

  // Restore API URL preference
  const savedUrl = localStorage.getItem("apiUrl");
  if (savedUrl) {
    API_URL = savedUrl;
    apiUrlInput.value = API_URL;
  }

  // Event Listeners
  updateUrlBtn.addEventListener("click", updateApiUrl);
  sendJsonBtn.addEventListener("click", sendJsonEvent);

  jsonInput.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      sendJsonEvent();
    }
  });

  // Start data flow
  fetchEvents();
  setupEventSource();
}

function loadLocalEvents() {
  const events = storage.load();
  if (events) {
    renderEvents(events, true);
  }
}

function setupEventSource() {
  if (eventSource) {
    eventSource.close();
  }

  console.log("📡 Connecting to event stream...");
  eventSource = new EventSource(`${API_URL}/api/events/stream`);

  eventSource.onopen = () => {
    console.log("✅ Stream connected");
    updateStatus(true);
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleStreamEvent(data);
    } catch (err) {
      console.error("Error parsing stream data:", err);
    }
  };

  eventSource.onerror = (err) => {
    console.error("Stream error:", err);
    updateStatus(false);
    eventSource.close();
    setTimeout(setupEventSource, 5000);
  };
}

function handleStreamEvent(data) {
  const { type, event } = data;

  if (type === "new_event") {
    const emptyState = document.querySelector(".empty-state");
    if (emptyState) emptyState.remove();

    const card = createEventCard(event);
    container.prepend(card);
    processedEventCount++;
    storage.saveEvent(event);
  } else if (type === "status_update") {
    updateEventCardStatus(event);
    storage.updateEvent(event);
  }
}

function updateEventCardStatus(event) {
  const existingCard = document.querySelector(
    `.event-card[data-id="${event.id}"]`,
  );
  if (!existingCard) return;

  // Replace the whole card with an updated one so new response data appears
  const newCard = createEventCard(event);
  existingCard.replaceWith(newCard);

  // If forwarding status badge exists, ensure it's shown (backwards compatibility)
  if (event.forwarding) {
    let badge = newCard.querySelector(".forwarding-badge");
    const newBadgeContent = `
            ${event.forwarding.status.toUpperCase()} ${event.forwarding.statusCode ? `(${event.forwarding.statusCode})` : ""}
        `;

    if (badge) {
      badge.textContent = newBadgeContent;
      badge.className = `forwarding-badge ${event.forwarding.status}`;
    } else {
      const headerRight = newCard.querySelector(".header-right");
      const statusHtml = `
                <div class="forwarding-badge ${event.forwarding.status}">
                    ${newBadgeContent}
                </div>
            `;
      headerRight.insertAdjacentHTML("afterbegin", statusHtml);
    }
  }
}

function updateApiUrl() {
  const newUrl = apiUrlInput.value.replace(/\/$/, "");
  if (newUrl) {
    API_URL = newUrl;
    localStorage.setItem("apiUrl", API_URL);

    processedEventCount = 0;
    container.innerHTML = '<div class="empty-state">Connecting...</div>';
    fetchEvents();
    setupEventSource(); // Reconnect
  }
}

async function sendJsonEvent() {
  const jsonText = jsonInput.value.trim();

  if (!jsonText) {
    showInputStatus("Please enter some JSON", "error");
    return;
  }

  try {
    const jsonData = JSON.parse(jsonText);

    sendJsonBtn.disabled = true;
    sendJsonBtn.textContent = "Sending...";

    const response = await fetch(`${API_URL}/api/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(jsonData),
    });

    if (!response.ok) throw new Error("Failed to send event");

    showInputStatus("✓ Event sent successfully!", "success");
    jsonInput.value = "";
  } catch (error) {
    if (error instanceof SyntaxError) {
      showInputStatus("Invalid JSON format", "error");
    } else {
      showInputStatus("Failed to send event", "error");
    }
    console.error("Send error:", error);
  } finally {
    sendJsonBtn.disabled = false;
    sendJsonBtn.textContent = "Send Event";
  }
}

function showInputStatus(message, type) {
  inputStatus.textContent = message;
  inputStatus.className = `input-status ${type}`;

  setTimeout(() => {
    inputStatus.textContent = "";
    inputStatus.className = "input-status";
  }, 3000);
}

async function fetchEvents() {
  try {
    const response = await fetch(`${API_URL}/api/events`);
    if (!response.ok) throw new Error("Network response was not ok");

    const events = await response.json();
    updateStatus(true);

    if (events && events.length > 0) {
      events.forEach((event) => storage.saveEvent(event));
      loadLocalEvents();
    } else {
      loadLocalEvents();
    }
  } catch (error) {
    console.error("Fetch error:", error);
    updateStatus(false);
    loadLocalEvents();
  }
}

function updateStatus(isOnline) {
  if (isOnline) {
    connectionStatus.textContent = "Live";
    connectionStatus.style.color = "var(--success)";
    document.querySelector(".dot").style.backgroundColor = "var(--success)";
    document.querySelector(".dot").style.boxShadow = "0 0 8px var(--success)";
  } else {
    connectionStatus.textContent = "Disconnected";
    connectionStatus.style.color = "#ef4444";
    document.querySelector(".dot").style.backgroundColor = "#ef4444";
    document.querySelector(".dot").style.boxShadow = "0 0 8px #ef4444";
  }
}

function renderEvents(events, isLocalLoad = false) {
  if (!events || events.length === 0) {
    if (!isLocalLoad) {
      container.innerHTML =
        '<div class="empty-state">No events yet. Send a POST request to add events.</div>';
    }
    processedEventCount = 0;
    return;
  }

  const emptyState = document.querySelector(".empty-state");
  if (emptyState) emptyState.remove();

  // Clear and render all
  container.innerHTML = "";
  events.forEach((event) => {
    const card = createEventCard(event);
    container.prepend(card);
    // Only save to local storage if it's a new event from the stream,
    // NOT when we are just rendering the initial state from the server (which might be empty or partial)
    // actually, we should probably NOT save here at all during bulk render.
    // The stream handler handles individual saves.
  });

  processedEventCount = events.length;
}

function createEventCard(event) {
  const div = document.createElement("div");
  div.className = "event-card";
  div.setAttribute("data-id", event.id || "");

  const timestamp = event.timestamp
    ? new Date(event.timestamp).toLocaleTimeString()
    : "Just now";
  const receivedAt = event.receivedAt || timestamp;

  const eventData = event.data || event;

  // Helper to pretty print JSON or fallback to raw string
  function prettyPrint(input) {
    if (input === null || input === undefined) return "";
    if (typeof input === "object") return JSON.stringify(input, null, 2);
    try {
      const parsed = JSON.parse(input);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return String(input);
    }
  }

  // Collapse long arrays for compact view
  function collapseArrays(str) {
    return str.replace(/\[\s*([\d\s,]+?)\s*\]/gs, (match, content) => {
      const collapsed = content.replace(/\s+/g, " ").trim();
      const oneLine = `[ ${collapsed} ]`;
      return oneLine.length < 120 ? oneLine : match;
    });
  }

  const requestContent = collapseArrays(prettyPrint(eventData));
  const hasResponse = !!event.response;

  const typeBadge = `
        <span class="type-badge ${event.type || "outbound"}">
            ${(event.type || "outbound").toUpperCase()}
        </span>
    `;

  const outboundBadge = hasResponse
    ? `
        <span class="type-badge outbound">OUTBOUND</span>
    `
    : "";

  const forwardingStatus = event.forwarding
    ? `
        <div class="forwarding-badge ${event.forwarding.status}">
            ${event.forwarding.status.toUpperCase()} ${event.forwarding.statusCode ? `(${event.forwarding.statusCode})` : ""}
        </div>
    `
    : "";

  // Build header
  const headerHtml = `
        <div class="event-header">
            <span class="timestamp">${receivedAt}</span>
            <div class="header-right">
                ${typeBadge}
                ${forwardingStatus}
                <span>Data</span>
            </div>
        </div>
    `;

  // Request visualizations (render inside the request column)
  const requestVisuals = generateVisualizations(eventData);

  // Handle case with no response yet
  if (!hasResponse) {
    // For outbound-only events the response may be stored in event.data.body
    if (event.type === "outbound" && event.data) {
      let fallbackRaw = event.data.body || event.data;
      let fallbackParsed = fallbackRaw;
      try {
        if (typeof fallbackParsed === "string")
          fallbackParsed = JSON.parse(fallbackParsed);
      } catch (e) {
        // not JSON
      }
      const fallbackVisuals = generateVisualizations(fallbackParsed);
      const fallbackContent = collapseArrays(prettyPrint(fallbackRaw));

      if (fallbackVisuals) {
        div.innerHTML = `${headerHtml}
          <div class="req-res-row">
            <div class="req-column">
              <div class="panel-header"><span class="panel-label inbound">Inbound</span></div>
              ${requestVisuals}
              <div class="event-content">${requestContent}</div>
            </div>
            <div class="res-column">
              <div class="panel-header"><span class="panel-label outbound">Outbound</span></div>
              ${fallbackVisuals}
              <div class="event-content">${fallbackContent}</div>
            </div>
          </div>
        `;
        return div;
      }
    }

    // Default: just show request visuals + content
    div.innerHTML = `${headerHtml}${requestVisuals}<div class="event-content">${requestContent}</div>`;
    return div;
  }

  // If we have a response, render request and response side-by-side
  const responseSummary = event.response || {};
  const responseBodyRaw = responseSummary.body || responseSummary;
  const responseContent = collapseArrays(prettyPrint(responseBodyRaw));

  // Try to parse response body into structured data for visualizations
  let responseDataForVisuals = responseBodyRaw;
  try {
    if (typeof responseDataForVisuals === "string") {
      responseDataForVisuals = JSON.parse(responseDataForVisuals);
    }
  } catch (e) {
    // not JSON — skip visuals
  }

  const responseVisuals = generateVisualizations(responseDataForVisuals);

  div.innerHTML = `${headerHtml}
        <div class="req-res-row">
            <div class="req-column">
                <div class="panel-header"><span class="panel-label inbound">Inbound</span></div>
                ${requestVisuals}
                <div class="event-content">${requestContent}</div>
            </div>
            <div class="res-column">
                <div class="panel-header"><span class="panel-label outbound">Outbound</span> <span class="status-code">${responseSummary.statusCode || ""}</span></div>
                ${responseVisuals}
                <div class="event-content">${responseContent}</div>
            </div>
        </div>
    `;

  return div;
}

// Start the app
init();
