const {
  OAUTH_TOKEN_EXCHANGE_FLAG,
  SANDBOX_OAUTH_TOKEN_URL,
  TOKEN_STRATEGY_MODES,
  buildEquifaxRuntimeConfig
} = require('../src/services/equifax/equifaxProviderConfig');
const {
  getEquifaxAccessToken
} = require('../src/services/equifax/equifaxTokenService');

async function run() {
  const config = buildEquifaxRuntimeConfig(process.env);
  const gate = validateTokenSmokeGates(config, process.env);

  if (!gate.ok) {
    printSafe({
      provider: 'equifax',
      environment: config.environment,
      tokenStrategy: config.tokenStrategy,
      tokenReady: false,
      scopeConfigured: Boolean(config.scope),
      oauthCredentialPlacementMode: config.oauthClientCredentialPlacementMode || 'unset',
      blockedReason: gate.blockedReason,
      missingKeys: gate.missingKeys,
      safeToRunLiveCall: false
    }, true);
    process.exitCode = 1;
    return;
  }

  const tokenResult = await getEquifaxAccessToken({
    config,
    env: process.env,
    forceRefresh: true
  });

  printSafe({
    provider: 'equifax',
    environment: config.environment,
    tokenStrategy: config.tokenStrategy,
    tokenReady: Boolean(tokenResult.ok),
    expiresInSeconds: tokenResult.status.expiresInSeconds || null,
    scopeConfigured: Boolean(tokenResult.status.scopeConfigured),
    oauthCredentialPlacementMode: tokenResult.status.oauthClientCredentialPlacementMode || 'unset',
    blockedReason: tokenResult.ok ? null : tokenResult.errorCode,
    safeToRunLiveCall: false
  }, !tokenResult.ok);

  if (!tokenResult.ok) {
    process.exitCode = 1;
  }
}

function validateTokenSmokeGates(config, env) {
  if (env.EQUIFAX_ENABLED !== 'true') {
    return blocked('equifax_provider_disabled');
  }

  if (env.EQUIFAX_ENVIRONMENT !== 'sandbox' || config.environment !== 'sandbox') {
    return blocked('sandbox_environment_required');
  }

  if (env.EQUIFAX_TOKEN_STRATEGY !== TOKEN_STRATEGY_MODES.clientCredentials) {
    return blocked('client_credentials_strategy_required');
  }

  if (env.EQUIFAX_PROVIDER_CALLS_ENABLED !== 'true') {
    return blocked('provider_calls_enabled_required');
  }

  if (env[OAUTH_TOKEN_EXCHANGE_FLAG] !== 'true') {
    return blocked('equifax_oauth_token_exchange_disabled');
  }

  if (config.tokenUrl !== SANDBOX_OAUTH_TOKEN_URL) {
    return blocked('equifax_oauth_sandbox_token_url_required');
  }

  if (!config.clientId || !config.clientSecret || !config.scope) {
    return blocked('equifax_oauth_client_credentials_missing', {
      missingKeys: [
        !config.clientId ? 'EQUIFAX_CLIENT_ID' : null,
        !config.clientSecret ? 'EQUIFAX_CLIENT_SECRET' : null,
        !config.scope ? 'EQUIFAX_SCOPE' : null
      ].filter(Boolean)
    });
  }

  if (config.scope !== config.officialScope) {
    return blocked('equifax_oauth_scope_invalid');
  }

  if (!config.oauthClientCredentialPlacementConfigured) {
    return blocked('equifax_oauth_credential_placement_not_configured');
  }

  return { ok: true, blockedReason: null };
}

function blocked(blockedReason, metadata = {}) {
  return {
    ok: false,
    blockedReason,
    missingKeys: Array.isArray(metadata.missingKeys) ? metadata.missingKeys : undefined
  };
}

function printSafe(payload, error = false) {
  const serialized = JSON.stringify(payload, null, 2);
  if (error) {
    console.error(serialized);
    return;
  }
  console.log(serialized);
}

if (require.main === module) {
  run().catch((error) => {
    printSafe({
      provider: 'equifax',
      environment: 'sandbox',
      tokenStrategy: 'client_credentials',
      tokenReady: false,
      blockedReason: 'equifax_oauth_token_request_failed',
      errorName: error && error.name ? error.name : 'Error',
      safeToRunLiveCall: false
    }, true);
    process.exitCode = 1;
  });
}

module.exports = {
  validateTokenSmokeGates
};
