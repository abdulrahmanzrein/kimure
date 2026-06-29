import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type TokenStrategy =
  | "disabled"
  | "sandbox_static_token"
  | "client_credentials_pending_docs";

type BlockedReason =
  | "equifax_provider_disabled"
  | "sandbox_static_token_test_disabled"
  | "sandbox_environment_required"
  | "sandbox_static_token_strategy_required"
  | "sandbox_access_token_required"
  | "provider_calls_enabled_required"
  | "official_sandbox_base_url_required"
  | "oauth_client_credentials_blocked_pending_docs"
  | "oauth_response_expiry_unconfirmed"
  | "sandbox_static_token_live_smoke_test_not_implemented"
  | "ready_for_safe_static_token_readiness_check";

export interface CreditProviderStatusResponse {
  provider: "equifax";
  environment: string;
  enabled: boolean;
  providerCallsEnabled: boolean;
  tokenStrategy: TokenStrategy;
  tokenReady: boolean;
  sandboxStaticTokenTestEnabled: boolean;
  sandboxStaticTokenTestReady: boolean;
  sandboxStaticTokenLiveSmokeTestEnabled: boolean;
  oauthClientCredentialsConfigured: boolean;
  oauthClientCredentialPlacementConfigured: boolean;
  oauthResponseExpiryConfirmed: boolean;
  blockedReason: BlockedReason;
  safeToRunLiveCall: false;
}

const officialSandboxBaseUrl =
  "https://api.sandbox.equifax.com/business/oneview/consumer-credit/v1";

@Injectable()
export class CreditProviderStatusService {
  constructor(private readonly config: ConfigService) {}

  getEquifaxProviderStatus(): CreditProviderStatusResponse {
    const enabled = this.getFlag("EQUIFAX_ENABLED");
    const environment = this.getString("EQUIFAX_ENVIRONMENT") || "sandbox";
    const providerCallsEnabled = this.getFlag("EQUIFAX_PROVIDER_CALLS_ENABLED");
    const requestedTokenStrategy =
      this.getString("EQUIFAX_TOKEN_STRATEGY") || "auto";
    const sandboxAccessTokenConfigured = this.hasValue(
      "EQUIFAX_SANDBOX_ACCESS_TOKEN"
    );
    const sandboxStaticTokenStrategy =
      requestedTokenStrategy === "sandbox_static_token" ||
      (requestedTokenStrategy === "auto" &&
        environment === "sandbox" &&
        sandboxAccessTokenConfigured);
    const tokenStrategy: TokenStrategy = !enabled
      ? "disabled"
      : sandboxStaticTokenStrategy
        ? "sandbox_static_token"
        : "client_credentials_pending_docs";
    const sandboxStaticTokenTestEnabled = this.getFlag(
      "EQUIFAX_SANDBOX_STATIC_TOKEN_TEST_ENABLED"
    );
    const sandboxStaticTokenLiveSmokeTestEnabled = this.getFlag(
      "EQUIFAX_SANDBOX_STATIC_TOKEN_LIVE_SMOKE_TEST_ENABLED"
    );
    const sandboxBaseUrlAllowed =
      this.getString("EQUIFAX_SANDBOX_BASE_URL") === officialSandboxBaseUrl;
    const tokenReady =
      enabled &&
      environment === "sandbox" &&
      tokenStrategy === "sandbox_static_token" &&
      sandboxAccessTokenConfigured;
    const oauthClientCredentialsConfigured =
      this.hasAnyValue("EQUIFAX_CLIENT_ID", "EQUIFAX_SANDBOX_CLIENT_ID") &&
      this.hasAnyValue(
        "EQUIFAX_CLIENT_SECRET",
        "EQUIFAX_SANDBOX_CLIENT_SECRET"
      ) &&
      this.hasAnyValue("EQUIFAX_SCOPE", "EQUIFAX_SANDBOX_SCOPE");
    const oauthClientCredentialPlacementConfigured =
      ["basic_auth", "form_body"].includes(
        this.getString("EQUIFAX_OAUTH_CLIENT_CREDENTIAL_PLACEMENT") || ""
      ) ||
      ["basic_auth", "form_body"].includes(
        this.getString(
          "EQUIFAX_SANDBOX_OAUTH_CLIENT_CREDENTIAL_PLACEMENT"
        ) || ""
      );
    const oauthResponseExpiryConfirmed = false;
    const blockedReason = this.getBlockedReason({
      enabled,
      environment,
      providerCallsEnabled,
      tokenStrategy,
      tokenReady,
      sandboxStaticTokenTestEnabled,
      sandboxStaticTokenLiveSmokeTestEnabled,
      sandboxBaseUrlAllowed,
      oauthClientCredentialPlacementConfigured,
      oauthResponseExpiryConfirmed
    });

    return {
      provider: "equifax",
      environment,
      enabled,
      providerCallsEnabled,
      tokenStrategy,
      tokenReady,
      sandboxStaticTokenTestEnabled,
      sandboxStaticTokenTestReady:
        blockedReason === "ready_for_safe_static_token_readiness_check",
      sandboxStaticTokenLiveSmokeTestEnabled,
      oauthClientCredentialsConfigured,
      oauthClientCredentialPlacementConfigured,
      oauthResponseExpiryConfirmed,
      blockedReason,
      safeToRunLiveCall: false
    };
  }

  private getBlockedReason(input: {
    enabled: boolean;
    environment: string;
    providerCallsEnabled: boolean;
    tokenStrategy: TokenStrategy;
    tokenReady: boolean;
    sandboxStaticTokenTestEnabled: boolean;
    sandboxStaticTokenLiveSmokeTestEnabled: boolean;
    sandboxBaseUrlAllowed: boolean;
    oauthClientCredentialPlacementConfigured: boolean;
    oauthResponseExpiryConfirmed: boolean;
  }): BlockedReason {
    if (!input.enabled) return "equifax_provider_disabled";

    if (input.tokenStrategy !== "sandbox_static_token") {
      if (!input.oauthClientCredentialPlacementConfigured) {
        return "oauth_client_credentials_blocked_pending_docs";
      }
      if (!input.oauthResponseExpiryConfirmed) {
        return "oauth_response_expiry_unconfirmed";
      }
      return "oauth_client_credentials_blocked_pending_docs";
    }

    if (!input.sandboxStaticTokenTestEnabled) {
      return "sandbox_static_token_test_disabled";
    }
    if (input.sandboxStaticTokenLiveSmokeTestEnabled) {
      return "sandbox_static_token_live_smoke_test_not_implemented";
    }
    if (input.environment !== "sandbox") return "sandbox_environment_required";
    if (!input.tokenReady) return "sandbox_access_token_required";
    if (!input.providerCallsEnabled) return "provider_calls_enabled_required";
    if (!input.sandboxBaseUrlAllowed) return "official_sandbox_base_url_required";

    return "ready_for_safe_static_token_readiness_check";
  }

  private getFlag(key: string): boolean {
    return this.getString(key) === "true";
  }

  private hasAnyValue(...keys: string[]): boolean {
    return keys.some((key) => this.hasValue(key));
  }

  private hasValue(key: string): boolean {
    return Boolean(this.getString(key));
  }

  private getString(key: string): string | undefined {
    const value = this.config.get<string>(key);
    return typeof value === "string" && value.trim()
      ? value.trim()
      : undefined;
  }
}
