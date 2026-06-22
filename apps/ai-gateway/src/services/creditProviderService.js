// Backward-compatible facade for the provider registry introduced in Step 6.
// Credit-profile orchestration imports this module; provider-specific code lives
// under creditProviders/ and remains backend-only.
module.exports = require('./creditProviders');

