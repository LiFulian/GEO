/* GEO Studio - Application Entry Point */

// Load modules in order
// utils.js → state.js → render.js → events.js

bindEvents();
load().catch(err => toast(err.message, "error"));
