const express = require('express');
const cors = require('cors');

const app = express();
const port = 8000;

// Update this to your target API URL
const EXTERNAL_API_URL = 'https://httpbin.org/post';

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static('public'));

let recentEvents = [];
const MAX_EVENTS = 100;

app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

app.get('/api/events', (req, res) => {
    res.json(recentEvents);
});

app.post('/api/events', (req, res) => {
    const payload = req.body;
    const timestamp = new Date().toISOString();

    const newEvent = {
        type: 'outbound',
        data: payload,
        timestamp: timestamp,
        receivedAt: new Date().toLocaleString(),
        forwarding: { status: 'pending', target: EXTERNAL_API_URL }
    };

    recentEvents.push(newEvent);
    if (recentEvents.length > MAX_EVENTS) recentEvents.shift();

    console.log(`📤 Forwarding event to ${EXTERNAL_API_URL}...`);

    fetch(EXTERNAL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(async response => {
            newEvent.forwarding.status = response.ok ? 'success' : 'failed';
            newEvent.forwarding.statusCode = response.status;
            console.log(`✅ Forwarded successfully: ${response.status}`);
        })
        .catch(error => {
            newEvent.forwarding.status = 'error';
            newEvent.forwarding.error = error.message;
            console.error(`❌ Forwarding failed:`, error.message);
        });

    res.status(201).json({ status: 'received', event: newEvent });
});

app.post('/api/webhook', (req, res) => {
    const payload = req.body;
    const timestamp = new Date().toISOString();

    const newEvent = {
        type: 'webhook',
        data: payload,
        timestamp: timestamp,
        receivedAt: new Date().toLocaleString()
    };

    recentEvents.push(newEvent);
    if (recentEvents.length > MAX_EVENTS) recentEvents.shift();

    console.log('📬 Received webhook data from external API');
    res.status(200).json({ status: 'received' });
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
