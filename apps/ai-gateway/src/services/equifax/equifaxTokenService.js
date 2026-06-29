const {
  buildEquifaxRuntimeConfig,
  OAUTH_CLIENT_CREDENTIAL_PLACEMENT_MODES,
  SANDBOX_OAUTH_TOKEN_URL,
  TOKEN_STRATEGY_MODES,
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

  if (!providerStatus.configReady && providerStatus.tokenStrategy !== TOKEN_STRATEGY_MODES.clientCredentials) {
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
      lastTokenHttpStatus: null,
      expiresInSeconds: null
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

  if (providerStatus.tokenStrategy === TOKEN_STRATEGY_MODES.clientCredentials) {
    const clientCredentialsGate = validateClientCredentialsTokenGate({ config, providerStatus });
    if (!clientCredentialsGate.ok) {
      updateLastStatus(clientCredentialsGate.errorCode, null);
      return buildTokenResult({
        ok: false,
        accessToken: null,
        errorCode: clientCredentialsGate.errorCode,
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

    const tokenResponse = await requestClientCredentialsToken({
      config,
      fetchImpl: options.fetchImpl || global.fetch
    });

    if (!tokenResponse.ok || !tokenResponse.accessToken) {
      updateLastStatus(tokenResponse.errorCode, tokenResponse.httpStatus || null);
      return buildTokenResult({
        ok: false,
        accessToken: null,
        errorCode: tokenResponse.errorCode,
        config,
        providerStatus,
        now,
        tokenResponse
      });
    }

    tokenCache = {
      token: tokenResponse.accessToken,
      expiresAt: tokenResponse.expiresAt,
      environment: providerStatus.environment,
      tokenStrategy: providerStatus.tokenStrategy,
      lastTokenStatus: 'client_credentials',
      lastTokenHttpStatus: tokenResponse.httpStatus || null,
      expiresInSeconds: tokenResponse.expiresInSeconds
    };

    return buildTokenResult({
      ok: true,
      accessToken: tokenResponse.accessToken,
      errorCode: null,
      config,
      providerStatus,
      now,
      tokenResponse
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
    lastTokenHttpStatus: null,
    expiresInSeconds: null
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
  now,
  tokenResponse = null
}) {
  return {
    ok,
    accessToken,
    errorCode,
    status: buildSafeTokenStatus({ config, providerStatus, now, tokenResponse })
  };
}

function buildSafeTokenStatus({ config, providerStatus, now, tokenResponse = null }) {
  const configuredForClientCredentials = Boolean(config.clientId && config.clientSecret && config.scope);
  const sandboxTokenConfigured = Boolean(config.sandboxAccessToken && providerStatus.environment === 'sandbox');
  const tokenConfigured = providerStatus.tokenStrategy === 'sandbox_static_token'
    ? sandboxTokenConfigured
    : configuredForClientCredentials;

  return {
    tokenConfigured,
    missingKeys: Array.isArray(providerStatus.missingKeys) ? providerStatus.missingKeys : [],
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
    oauthTokenExchangeEnabled: Boolean(providerStatus.oauthTokenExchangeEnabled),
    oauthTokenExchangeReady: Boolean(providerStatus.oauthTokenExchangeReady),
    oauthBlockedUntilTokenExchangeEnabled: Boolean(providerStatus.oauthBlockedUntilTokenExchangeEnabled),
    oauthBlockedUntilSandboxTokenUrl: Boolean(providerStatus.oauthBlockedUntilSandboxTokenUrl),
    sandboxStaticTokenTestEnabled: Boolean(providerStatus.sandboxStaticTokenTestEnabled),
    sandboxStaticTokenLiveSmokeTestEnabled: Boolean(providerStatus.sandboxStaticTokenLiveSmokeTestEnabled),
    sandboxStaticTokenTestReady: Boolean(providerStatus.sandboxStaticTokenTestReady),
    sandboxStaticTokenTestUrlAllowed: Boolean(providerStatus.sandboxStaticTokenTestUrlAllowed),
    sandboxStaticTokenTestBlockedReason: providerStatus.sandboxStaticTokenTestBlockedReason || null,
    providerCallsEnabled: Boolean(providerStatus.providerCallsEnabled),
    tokenCached: Boolean(tokenCache.token),
    tokenReady: Boolean(providerStatus.tokenReady || tokenResponse && tokenResponse.accessToken),
    expiresInSeconds: tokenResponse && Number.isFinite(tokenResponse.expiresInSeconds)
      ? tokenResponse.expiresInSeconds
      : tokenCache.expiresInSeconds,
    expiresSoon: doesTokenExpireSoon(now),
    environment: providerStatus.environment,
    tokenStrategy: providerStatus.tokenStrategy,
    lastTokenStatus: tokenCache.lastTokenStatus,
    lastTokenHttpStatus: tokenCache.lastTokenHttpStatus
  };
}

function validateClientCredentialsTokenGate({ config, providerStatus }) {
  if (providerStatus.environment !== 'sandbox') {
    return { ok: false, errorCode: 'equifax_oauth_sandbox_environment_required' };
  }

  if (!providerStatus.providerCallsEnabled) {
    return { ok: false, errorCode: 'equifax_provider_calls_disabled' };
  }

  if (!providerStatus.oauthTokenExchangeEnabled) {
    return { ok: false, errorCode: 'equifax_oauth_token_exchange_disabled' };
  }

  if (config.tokenUrl !== SANDBOX_OAUTH_TOKEN_URL) {
    return { ok: false, errorCode: 'equifax_oauth_sandbox_token_url_required' };
  }

  if (!config.clientId || !config.clientSecret || !config.scope) {
    return { ok: false, errorCode: 'equifax_oauth_client_credentials_missing' };
  }

  if (config.scope !== config.officialScope) {
    return { ok: false, errorCode: 'equifax_oauth_scope_invalid' };
  }

  if (!providerStatus.oauthClientCredentialPlacementConfigured) {
    return { ok: false, errorCode: 'equifax_oauth_credential_placement_not_configured' };
  }

  if (![
    OAUTH_CLIENT_CREDENTIAL_PLACEMENT_MODES.basicAuth,
    OAUTH_CLIENT_CREDENTIAL_PLACEMENT_MODES.formBody
  ].includes(config.oauthClientCredentialPlacementMode)) {
    return { ok: false, errorCode: 'equifax_oauth_credential_placement_invalid' };
  }

  if (Array.isArray(providerStatus.errors) && providerStatus.errors.length > 0) {
    return { ok: false, errorCode: 'equifax_configuration_invalid' };
  }

  return { ok: true, errorCode: null };
}

async function requestClientCredentialsToken({ config, fetchImpl }) {
  if (typeof fetchImpl !== 'function') {
    return {
      ok: false,
      errorCode: 'equifax_fetch_unavailable',
      httpStatus: null,
      accessToken: null,
      expiresAt: null,
      expiresInSeconds: null
    };
  }

  const body = new URLSearchParams();
  body.set('grant_type', config.oauthGrantType);
  body.set('scope', config.scope);

  const headers = {
    'Content-Type': config.oauthTokenContentType,
    Accept: 'application/json'
  };

  if (config.oauthClientCredentialPlacementMode === OAUTH_CLIENT_CREDENTIAL_PLACEMENT_MODES.basicAuth) {
    headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`, 'utf8').toString('base64')}`;
  } else if (config.oauthClientCredentialPlacementMode === OAUTH_CLIENT_CREDENTIAL_PLACEMENT_MODES.formBody) {
    body.set('client_id', config.clientId);
    body.set('client_secret', config.clientSecret);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetchImpl(config.tokenUrl, {
      method: config.oauthTokenMethod,
      headers,
      body: body.toString(),
      signal: controller.signal
    });
    const responseText = await response.text();
    const parsedBody = parseJsonSafely(responseText);

    if (!response.ok) {
      return {
        ok: false,
        errorCode: 'equifax_oauth_token_http_error',
        httpStatus: response.status,
        accessToken: null,
        expiresAt: null,
        expiresInSeconds: null
      };
    }

    const accessToken = parsedBody && typeof parsedBody.access_token === 'string'
      ? parsedBody.access_token
      : null;
    const expiresInSeconds = parsedBody && Number.isFinite(Number(parsedBody.expires_in))
      ? Number(parsedBody.expires_in)
      : null;

    return {
      ok: Boolean(accessToken),
      errorCode: accessToken ? null : 'equifax_oauth_access_token_missing',
      httpStatus: response.status,
      accessToken,
      expiresAt: expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null,
      expiresInSeconds
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonSafely(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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
