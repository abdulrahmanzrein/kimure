const {
  buildEquifaxRuntimeConfig,
  validateEquifaxProviderConfig
} = require('./equifaxProviderConfig');

const TOKEN_EXPIRY_SKEW_MS = 5 * 60 * 1000;

let tokenCache = createEmptyTokenCache();

async function getEquifaxAccessToken(options = {}) {
  const env = options.env || process.env;
  const config = options.config || buildEquifaxRuntimeConfig(env);
  const providerStatus = config.providerConfigStatus || validateEquifaxProviderConfig(env);
  const now = options.now instanceof Date ? options.now : new Date();

  if (!providerStatus.enabled) {
    updateLastStatus('disabled', null);
    return buildTokenResult({
      ok: false,
      accessToken: null,
      errorCode: 'equifax_provider_disabled',
      config,
      providerStatus,
      now
    });
  }

  if (!providerStatus.configReady) {
    updateLastStatus('configuration_not_ready', null);
    return buildTokenResult({
      ok: false,
      accessToken: null,
      errorCode: 'equifax_configuration_not_ready',
      config,
      providerStatus,
      now
    });
  }

  if (providerStatus.tokenStrategy === 'sandbox_static_token') {
    if (providerStatus.environment !== 'sandbox' || !config.sandboxAccessToken) {
      updateLastStatus('sandbox_static_token_rejected', null);
      return buildTokenResult({
        ok: false,
        accessToken: null,
        errorCode: 'equifax_sandbox_static_token_rejected',
        config,
        providerStatus,
        now
      });
    }

    tokenCache = {
      token: config.sandboxAccessToken,
      expiresAt: null,
      environment: providerStatus.environment,
      tokenStrategy: providerStatus.tokenStrategy,
      lastTokenStatus: 'sandbox_static_token',
      lastTokenHttpStatus: null
    };

    return buildTokenResult({
      ok: true,
      accessToken: config.sandboxAccessToken,
      errorCode: null,
      config,
      providerStatus,
      now
    });
  }

  if (!options.forceRefresh && isCachedTokenUsable(providerStatus, now)) {
    tokenCache.lastTokenStatus = 'cache_hit';
    return buildTokenResult({
      ok: true,
      accessToken: tokenCache.token,
      errorCode: null,
      config,
      providerStatus,
      now
    });
  }

  // Equifax docs confirm OAuth 2.0 client credentials and a POST token call.
  // The OneView Sandbox Postman collection confirms the sandbox token endpoint,
  // application/x-www-form-urlencoded content type, and form fields:
  // grant_type=client_credentials and the OneView scope. Manual Postman
  // inspection found request auth inherits from a parent collection with no
  // auth configured, so client credential placement remains unconfirmed even
  // though client_id/client_secret variables exist. Placement is configurable
  // as basic_auth or form_body for future portal-confirmed setup. Response
  // fields and expiry semantics are also still not confirmed. This skeleton
  // intentionally makes no network call and no guessed credential placement.
  updateLastStatus('equifax_token_flow_requires_portal_docs', null);
  return buildTokenResult({
    ok: false,
    accessToken: null,
    errorCode: 'equifax_token_flow_requires_portal_docs',
    config,
    providerStatus,
    now
  });
}

function getEquifaxTokenStatus(options = {}) {
  const env = options.env || process.env;
  const config = options.config || buildEquifaxRuntimeConfig(env);
  const providerStatus = config.providerConfigStatus || validateEquifaxProviderConfig(env);
  const now = options.now instanceof Date ? options.now : new Date();

  return buildSafeTokenStatus({ config, providerStatus, now });
}

function resetEquifaxTokenCache() {
  tokenCache = createEmptyTokenCache();
}

function createEmptyTokenCache() {
  return {
    token: null,
    expiresAt: null,
    environment: null,
    tokenStrategy: null,
    lastTokenStatus: 'not_requested',
    lastTokenHttpStatus: null
  };
}

function isCachedTokenUsable(providerStatus, now) {
  if (!tokenCache.token) return false;
  if (tokenCache.environment !== providerStatus.environment) return false;
  if (tokenCache.tokenStrategy !== providerStatus.tokenStrategy) return false;
  if (!tokenCache.expiresAt) return false;

  return tokenCache.expiresAt.getTime() - now.getTime() > TOKEN_EXPIRY_SKEW_MS;
}

function buildTokenResult({
  ok,
  accessToken,
  errorCode,
  config,
  providerStatus,
  now
}) {
  return {
    ok,
    accessToken,
    errorCode,
    status: buildSafeTokenStatus({ config, providerStatus, now })
  };
}

function buildSafeTokenStatus({ config, providerStatus, now }) {
  const configuredForClientCredentials = Boolean(config.clientId && config.clientSecret && config.scope);
  const sandboxTokenConfigured = Boolean(config.sandboxAccessToken && providerStatus.environment === 'sandbox');
  const tokenConfigured = providerStatus.tokenStrategy === 'sandbox_static_token'
    ? sandboxTokenConfigured
    : configuredForClientCredentials;

  return {
    tokenConfigured,
    sandboxTokenConfigured,
    clientCredentialsConfigured: configuredForClientCredentials,
    memberNumberConfigured: Boolean(config.memberNumber),
    securityCodeConfigured: Boolean(config.securityCode),
    permissiblePurposeConfigured: Boolean(config.permissiblePurposeCode),
    scopeConfigured: Boolean(config.scope),
    oauthGrantTypeConfirmed: true,
    oauthTokenPostConfirmed: true,
    oauthTokenEndpointConfigured: Boolean(config.tokenUrl),
    oauthTokenContentTypeConfirmed: Boolean(config.oauthTokenContentType),
    oauthScopeConfirmed: config.scope === config.officialScope,
    oauthClientCredentialPlacementConfirmed: Boolean(config.oauthClientCredentialPlacementConfirmed),
    oauthClientCredentialPlacementConfigured: Boolean(config.oauthClientCredentialPlacementConfigured),
    oauthClientCredentialPlacementMode: config.oauthClientCredentialPlacementMode || 'unset',
    postmanTokenRequestAuthMode: config.postmanTokenRequestAuthMode || null,
    postmanCollectionAuthMode: config.postmanCollectionAuthMode || null,
    postmanCredentialPlacementConfirmed: Boolean(config.postmanCredentialPlacementConfirmed),
    oauthResponseExpiryConfirmed: Boolean(config.oauthResponseExpiryConfirmed),
    oauthRequestFormatConfirmed: Boolean(config.oauthRequestFormatConfirmed),
    oauthBlockedUntilPortalDocs: providerStatus.tokenStrategy === 'client_credentials_pending_docs',
    oauthBlockedUntilCredentialPlacement: Boolean(providerStatus.oauthBlockedUntilCredentialPlacement),
    oauthBlockedUntilResponseExpiry: Boolean(providerStatus.oauthBlockedUntilResponseExpiry),
    oauthBlockedUntilProviderCallsEnabled: Boolean(providerStatus.oauthBlockedUntilProviderCallsEnabled),
    providerCallsEnabled: Boolean(providerStatus.providerCallsEnabled),
    tokenCached: Boolean(tokenCache.token),
    expiresSoon: doesTokenExpireSoon(now),
    environment: providerStatus.environment,
    tokenStrategy: providerStatus.tokenStrategy,
    lastTokenStatus: tokenCache.lastTokenStatus,
    lastTokenHttpStatus: tokenCache.lastTokenHttpStatus
  };
}

function doesTokenExpireSoon(now) {
  if (!tokenCache.token || !tokenCache.expiresAt) return false;
  return tokenCache.expiresAt.getTime() - now.getTime() <= TOKEN_EXPIRY_SKEW_MS;
}

function updateLastStatus(lastTokenStatus, lastTokenHttpStatus) {
  tokenCache = {
    ...tokenCache,
    lastTokenStatus,
    lastTokenHttpStatus
  };
}

module.exports = {
  getEquifaxAccessToken,
  getEquifaxTokenStatus,
  resetEquifaxTokenCache
};
