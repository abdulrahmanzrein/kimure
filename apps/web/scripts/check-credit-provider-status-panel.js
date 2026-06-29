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
const sandboxHtml = html.slice(
  html.indexOf("creditSandboxVerificationTitle"),
  html.indexOf("</aside>")
);
const sandboxHelper = sliceBetween(
  auth,
  "async function requestCreditProviderSandboxVerification()",
  "  // Ask Supabase who is logged in right now."
);
const sandboxRenderer = sliceBetween(
  js,
  "function normalizeSandboxVerification(response)",
  "async function loadProviderStatus()"
);
const sandboxPayload = sliceBetween(
  sandboxHelper,
  "var payload = {",
  "};"
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
  "creditSandboxVerificationTitle",
  "Run sandbox provider verification",
  "creditSandboxConsent",
  "creditSandboxVerifyButton",
  "Sandbox only",
  "Requires a signed-in session",
  "fake sandbox identity",
  "Do not enter real SIN/SSN",
  "personal credit data for this check",
  "No live Equifax call is made by the browser",
  "creditSandboxVerificationState",
  "creditSandboxProvider",
  "creditSandboxStatus",
  "creditSandboxProviderStatus",
  "creditSandboxVerified",
  "creditSandboxTransactionId",
  "creditSandboxSafeLiveCall",
  "creditSandboxBlockedReason",
  "creditSandboxScoreSummary",
  "creditSandboxDebtSummary",
  "creditSandboxRiskFlags"
].forEach((required) => {
  assert.equal(html.includes(required), true, `${required} is missing from sandbox verification UI`);
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

[
  "requestCreditProviderSandboxVerification",
  'getApiBaseUrl() + "/credit/provider-sandbox-verification"',
  'Authorization: "Bearer " + token',
  "Please sign in to run sandbox provider verification.",
  "normalizeSandboxVerification",
  "renderSandboxVerification",
  "sandboxVerifyButton.disabled = !sandboxConsent.checked",
  "textContent"
].forEach((required) => {
  assert.equal((auth + js).includes(required), true, `${required} is missing from sandbox verification JS`);
});

[
  "consent: true",
  'permissiblePurposeCode: "57"',
  "sandboxIdentity: true"
].forEach((required) => {
  assert.equal(sandboxPayload.includes(required), true, `${required} is missing from sandbox request body`);
});
assert.deepEqual(
  Array.from(sandboxPayload.matchAll(/^\s*([A-Za-z0-9_]+):/gm)).map((match) => match[1]).sort(),
  ["consent", "permissiblePurposeCode", "sandboxIdentity"].sort(),
  "sandbox verification request body must contain only the approved fields"
);

assert.equal(js.includes("innerHTML"), false, "credit-profile.js must not use innerHTML");
assert.equal(css.includes("credit-provider-readiness"), true);
assert.equal(css.includes("credit-sandbox-verification"), true);
assert.equal((html + js + auth).includes("api.sandbox.equifax.com"), false, "frontend must not contain an Equifax API URL");

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
  assert.equal(sandboxHtml.includes(forbidden), false, `${forbidden} should not appear in sandbox verification HTML`);
  assert.equal(auth.includes(forbidden), false, `${forbidden} should not appear in provider status auth helper`);
});

[
  "firstName",
  "lastName",
  "name",
  "address",
  "sin",
  "ssn",
  "member",
  "security",
  "customer",
  "client",
  "secret"
].forEach((forbidden) => {
  assert.equal(
    sandboxPayload.toLowerCase().includes(forbidden.toLowerCase()),
    false,
    `${forbidden} must not be included in the sandbox verification request body`
  );
});

[
  "sourceResponse",
  "contentBase64",
  "rawProviderResponse",
  "rawReport",
  "reportPayload",
  "tradelines",
  "trades",
  "pdfLink",
  "fullIdentity",
  "fullAddress",
  "socialInsuranceNumber",
  "providerDiagnostics",
  "Authorization"
].forEach((forbidden) => {
  assert.equal(
    sandboxRenderer.includes(forbidden),
    false,
    `${forbidden} must not be rendered in sandbox verification output`
  );
});

console.log("Credit provider status panel checks passed.");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function sliceBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `${start} was not found`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `${end} was not found after ${start}`);
  return source.slice(startIndex, endIndex);
}
