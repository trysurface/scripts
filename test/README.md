# Surface Form Embedding Test Suite

A comprehensive test suite for testing Surface Form embedding functionality, including different embed types and postMessage event monitoring.

## Getting Started

### Running the Test Suite

1. **Open in Live Server**
   - Open `test/index.html` in your IDE
   - Start Live Server (or any local HTTP server)

2. **Navigate to Live Server Address**
   - Go to the live server URL in your browser (e.g., `http://127.0.0.1:5500/test/index.html`)

3. **Select an Embed Type**
   - You'll see four test pages available:
     - **Popup Embed** - Modal popup form
     - **Slideover Embed** - Side panel form
     - **Inline Embed** - Embedded iframe form
     - **Input Trigger Embed** - Email input triggered form

4. **Test the Form**
   - Click on any embed type page to open it
   - The test form (from Arjunsahai's team) will load when you trigger the embed

5. **Monitor Events & Run Stress Tests**
   - All postMessage events are logged in the Events Log section
   - Use the **Stress Test** button to simulate high-load scenarios

---

## Test Pages

| Page | Description | Trigger |
|------|-------------|---------|
| `popup.html` | Tests popup modal embedding | Click "Open Popup" button |
| `slideover.html` | Tests slideover panel embedding | Click "Open Slideover" button |
| `inline.html` | Tests inline iframe embedding | Click "Show Inline Form" button |
| `input-trigger.html` | Tests input trigger with email prefill | Submit email form |

---

## Features

### Event Monitoring

Each test page includes real-time event monitoring:

- **Events Summary** - Shows counts for:
  - Total Events
  - Sent to Iframe
  - Received from Iframe
  - STORE_UPDATE events
  - LEAD_DATA_UPDATE events
  - SEND_DATA events

- **Events Log** - Detailed log of all postMessage events with:
  - Timestamp
  - Event type
  - Sender information
  - Full payload data

- **Export Events** - Download all logged events as JSON

### Stress Testing

Stress test buttons are available to simulate high-load scenarios by making 50 sequential API calls.

---

## Event Types

### Events Sent TO Iframe (from surface_tag.js)

| Event | Description |
|-------|-------------|
| `STORE_UPDATE` | Sent when store data needs to be updated (cookies, URL params, partial filled data) |
| `LEAD_DATA_UPDATE` | Sent when lead identification data is updated (leadId, leadSessionId, fingerprint) |

### Events Received FROM Iframe

| Event | Description |
|-------|-------------|
| `SEND_DATA` | Request from iframe to send current store data |

### Event Payload Structure

```json
{
  "windowUrl": "Current page URL",
  "referrer": "Page referrer",
  "cookies": { /* Parsed cookies */ },
  "origin": "Page origin",
  "questionIds": [ /* Partial filled data */ ],
  "urlParams": { /* URL search params */ },
  "surfaceLeadData": {
    "leadId": "...",
    "leadSessionId": "...",
    "fingerprint": "...",
    "landingPageUrl": "...",
    "expiry": "timestamp"
  }
}
```

---

## URL Parameters

Customize test behavior with URL parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `surfaceDebug=true` | Enable debug mode (logs to console) | `?surfaceDebug=true` |
| `showSurfaceForm=true` | Auto-show form on page load | `?showSurfaceForm=true` |
| `formSrc=URL` | Override default form source URL | `?formSrc=https://...` |
| `embedType=TYPE` | Override embed type | `?embedType=popup` |
| `popupSize=SIZE` | Override popup size | `?popupSize=large` |
| `siteId=ID` | Override environment ID | `?siteId=abc123` |

---

## File Structure

```
test/
├── index.html          # Main test suite landing page
├── popup.html          # Popup embed test page
├── slideover.html      # Slideover embed test page
├── inline.html         # Inline embed test page
├── input-trigger.html  # Input trigger embed test page
├── config.js           # Shared configuration (form source, environment ID)
├── event-monitor.js    # Event logging and monitoring utilities
├── stressTest.js       # Stress test functionality
├── common.css          # Shared styles for all test pages
└── README.md           # This file
```

---

## Configuration

Default configuration is set in `config.js`:

- **Form Source**: `https://forms.withsurface.com/s/cmjren87f0022l40bqtyjvmbe`
- **Environment ID**: `cllo318mt0003mb08hnp0f5zy`

These can be overridden via URL parameters.

---
