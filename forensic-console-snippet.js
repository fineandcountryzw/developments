// FORENSIC DEBUG CONSOLE SNIPPET
// Paste this in browser console (F12) to monitor all database operations in real-time

// ==================== FORENSIC EVENT TRACKER ====================
window.forensicLog = {
  events: [],
  
  // Start monitoring
  start: function() {
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args) => {
      const msg = args.join(' ');
      if (msg.includes('[FORENSIC]')) {
        this.events.push({
          type: 'LOG',
          message: msg,
          timestamp: new Date().toISOString(),
          data: args[1] || null
        });
      }
      originalLog(...args);
    };
    
    console.error = (...args) => {
      const msg = args.join(' ');
      if (msg.includes('[FORENSIC]')) {
        this.events.push({
          type: 'ERROR',
          message: msg,
          timestamp: new Date().toISOString(),
          data: args[1] || null
        });
      }
      originalError(...args);
    };
    
    console.log('%c🔍 FORENSIC MONITORING ACTIVE', 'color: #85754E; font-weight: bold; font-size: 14px;');
  },
  
  // Display all captured events
  show: function() {
    console.table(this.events);
  },
  
  // Filter by operation type
  filter: function(type) {
    return this.events.filter(e => e.message.includes(`[FORENSIC][${type}]`));
  },
  
  // Show errors only
  errors: function() {
    return this.events.filter(e => e.type === 'ERROR');
  },
  
  // Export as JSON
  export: function() {
    return JSON.stringify(this.events, null, 2);
  },
  
  // Clear all events
  clear: function() {
    this.events = [];
  }
};

// Start monitoring
window.forensicLog.start();

// ==================== USAGE EXAMPLES ====================

// After performing an action (Save Development, Upload Image), run:
// window.forensicLog.show()                    // Show all events in table
// window.forensicLog.filter('DB MUTATION')      // Show only mutations
// window.forensicLog.filter('UPLOAD')           // Show only uploads
// window.forensicLog.errors()                   // Show errors only
// copy(window.forensicLog.export())             // Copy all logs as JSON

// Example: Trace a single development save
// 1. Click Save button
// 2. Run: window.forensicLog.filter('SAVE FORM')
// 3. Then: window.forensicLog.filter('DB RESPONSE')
// 4. Look for "rows_affected: 1" = SUCCESS

// Example: Trace an upload failure
// 1. Try to upload an image
// 2. Run: window.forensicLog.errors()
// 3. Look for error code (e.g., "PAYLOAD_TOO_LARGE", "BUCKET_NOT_FOUND")

console.log('%c✅ Forensic monitoring ready. Use window.forensicLog.show() to view events.', 'color: green; font-weight: bold;');
