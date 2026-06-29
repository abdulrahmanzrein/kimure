const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = read("public/credit-profile.html");
const js = read("public/assets/js/credit-profile.js");
const css = read("public/assets/css/credit-profile.css");
const auth = read("public/assets/js/auth.js");
const panelHtml = html.slice(
  html.indexOf("creditProviderReadinessTitle"),
  html.indexOf("</aside>")
);

[
  "creditProviderReadinessTitle",
  "creditProviderReadinessState",
  "creditProviderStatusList",
  "creditStatusProvider",
  "creditStatusEnvironment",
  "creditStatusEnabled",
  "creditStatusProviderCalls",
  "creditStatusTokenStrategy",
  "creditStatusTokenReady",
  "creditStatusStaticTestEnabled",
  "creditStatusStaticTestReady",
  "creditStatusSafeLiveCall",
  "creditStatusBlockedReason",
  "No live Equifax call is made by this panel",
  "Secrets and raw bureau data are never displayed"
].forEach((required) => {
  assert.equal(html.includes(required), true, `${required} is missing from credit-profile.html`);
});

[
  "fetchCreditProviderStatus",
  'getApiBaseUrl() + "/credit/provider-status"',
  "normalizeProviderStatus",
  "renderProviderStatus",
  "textContent",
  "creditStatusSafeLiveCall",
  "creditStatusBlockedReason"
].forEach((required) => {
  assert.equal((auth + js).includes(required), true, `${required} is missing from frontend JS`);
});

assert.equal(js.includes("innerHTML"), false, "credit-profile.js must not use innerHTML");
assert.equal(css.includes("credit-provider-readiness"), true);

[
  "accessToken",
  "clientId",
  "clientSecret",
  "memberNumber",
  "securityCode",
  "customerCode",
  "requestBody",
  "rawProviderResponse",
  "rawReport",
  "reportPayload",
  "tradelines",
  "trades",
  "pdfLink",
  "fullIdentity",
  "fullAddress",
  "socialInsuranceNumber",
  "sourceResponse",
  "contentBase64",
  "providerDiagnostics",
  "GEMINI_API_KEY",
  "EQUIFAX_SANDBOX_ACCESS_TOKEN"
].forEach((forbidden) => {
  assert.equal(panelHtml.includes(forbidden), false, `${forbidden} should not appear in provider panel HTML`);
  assert.equal(auth.includes(forbidden), false, `${forbidden} should not appear in provider status auth helper`);
});

console.log("Credit provider status panel checks passed.");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}
