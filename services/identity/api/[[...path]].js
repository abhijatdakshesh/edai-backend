'use strict';

// Pre-built Nest app (tsc) — preserves emitDecoratorMetadata for DI / Swagger.
const mod = require('../dist/vercel-handler.js');
module.exports = mod.default ?? mod;
