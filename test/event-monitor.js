// Shared event monitoring functionality for Surface Form test pages

// Event tracking
let eventCounts = {
  total: 0,
  sent: 0,
  received: 0,
  storeUpdate: 0,
  leadDataUpdate: 0,
  sendData: 0
};

// Initialize event logging
function logEvent(event, direction) {
  eventCounts.total++;
  if (direction === 'sent') {
    eventCounts.sent++;
  } else {
    eventCounts.received++;
  }

  // Update counts by type
  if (event.type === 'STORE_UPDATE') {
    eventCounts.storeUpdate++;
  } else if (event.type === 'LEAD_DATA_UPDATE') {
    eventCounts.leadDataUpdate++;
  } else if (event.type === 'SEND_DATA') {
    eventCounts.sendData++;
  }

  updateEventSummary();
  
  const log = document.getElementById("eventsLog");
  if (!log) return;
  
  const eventItem = document.createElement("div");
  eventItem.className = "event-item";
  
  const time = new Date().toLocaleTimeString();
  const sender = event.sender || (direction === 'sent' ? 'surface_tag' : 'iframe');
  const type = event.type || 'UNKNOWN';
  const payload = event.payload || event;
  
  eventItem.innerHTML = `
    <div class="event-time">[${time}]</div>
    <div>
      <span class="event-type">${type}</span>
      <span class="event-sender">from ${sender}</span>
      <span style="color: ${direction === 'sent' ? '#4ec9b0' : '#ce9178'}">(${direction})</span>
    </div>
    <div class="event-payload">${JSON.stringify(payload, null, 2)}</div>
  `;
  
  log.insertBefore(eventItem, log.firstChild);
  
  // Keep only last 100 events
  while (log.children.length > 100) {
    log.removeChild(log.lastChild);
  }
}

function updateEventSummary() {
  const totalEl = document.getElementById("totalEvents");
  const sentEl = document.getElementById("sentEvents");
  const receivedEl = document.getElementById("receivedEvents");
  const storeUpdateEl = document.getElementById("storeUpdateEvents");
  const leadDataEl = document.getElementById("leadDataEvents");
  const sendDataEl = document.getElementById("sendDataEvents");
  
  if (totalEl) totalEl.textContent = eventCounts.total;
  if (sentEl) sentEl.textContent = eventCounts.sent;
  if (receivedEl) receivedEl.textContent = eventCounts.received;
  if (storeUpdateEl) storeUpdateEl.textContent = eventCounts.storeUpdate;
  if (leadDataEl) leadDataEl.textContent = eventCounts.leadDataUpdate;
  if (sendDataEl) sendDataEl.textContent = eventCounts.sendData;
}

function clearEventLog() {
  const log = document.getElementById("eventsLog");
  if (log) {
    log.innerHTML = "";
  }
  eventCounts = {
    total: 0,
    sent: 0,
    received: 0,
    storeUpdate: 0,
    leadDataUpdate: 0,
    sendData: 0
  };
  updateEventSummary();
}

function exportEvents() {
  const events = Array.from(document.querySelectorAll('.event-item')).map(item => {
    return {
      time: item.querySelector('.event-time').textContent,
      type: item.querySelector('.event-type').textContent,
      sender: item.querySelector('.event-sender').textContent,
      payload: item.querySelector('.event-payload').textContent
    };
  });
  
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `surface-events-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Initialize event monitoring
function initializeEventMonitoring() {
  // Monitor messages sent to iframes by intercepting notifyIframe
  if (typeof SurfaceTagStore !== 'undefined') {
    const originalNotifyIframe = SurfaceTagStore.notifyIframe;
    SurfaceTagStore.notifyIframe = function(iframe, type) {
      const result = originalNotifyIframe.call(this, iframe, type);
      
      // Get the payload that would be sent
      const payload = this.getPayload();
      logEvent({
        type: type,
        payload: payload,
        sender: 'surface_tag'
      }, 'sent');
      
      return result;
    };
  }

  // Monitor messages received from iframes
  window.addEventListener('message', function(event) {
    const surfaceDomains = [
      "https://forms.withsurface.com",
      "https://app.withsurface.com",
      "https://dev.withsurface.com"
    ];
    
    if (surfaceDomains.includes(event.origin) && event.data) {
      logEvent({
        type: event.data.type || 'UNKNOWN',
        payload: event.data.payload || event.data,
        sender: event.data.sender || 'iframe',
        origin: event.origin
      }, 'received');
    }
  }, true); // Use capture phase to log before other handlers

  // Log initial page load
  window.addEventListener('load', () => {
    logEvent({
      type: 'PAGE_LOADED',
      payload: {
        url: window.location.href,
        timestamp: new Date().toISOString()
      },
      sender: 'test_page'
    }, 'sent');
  });
}

// Make functions globally available
window.logEvent = logEvent;
window.clearEventLog = clearEventLog;
window.exportEvents = exportEvents;
window.updateEventSummary = updateEventSummary;

