const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = read("public/dashboard.html");
const js = read("public/assets/js/dashboard.js");
const auth = read("public/assets/js/auth.js");

[
  "dashboardStateTitle",
  "dashboardCreditCard",
  "dashboardFinancialCard",
  "dashboardMortgageCard",
  "dashboardConsentCard",
  "dashboardInsightsCard",
  "credit-profile.html",
  "mortgage.html",
  "marketplace.html#marketplace-ai-tools",
  "onboarding-form.html"
].forEach((required) => {
  assert.equal(html.includes(required), true, `${required} is missing`);
});

[
  "fetchDashboardAiCredit",
  'getApiBaseUrl() + "/dashboard/ai-credit"',
  'Authorization: "Bearer " + token'
].forEach((required) => {
  assert.equal(auth.includes(required), true, `${required} is missing`);
});

[
  "readinessScore",
  "riskLevel",
  "annualIncome",
  "monthlyDebt",
  "recommendations",
  "nextSteps"
].forEach((required) => {
  assert.equal(js.includes(required), true, `${required} is missing`);
});

[
  "socialInsuranceNumber",
  "dateOfBirth",
  "fullAddress",
  "sourceResponse",
  "contentBase64",
  "providerDiagnostics",
  "assessment_id_hash",
  "credit_mortgage_handoff",
  "creditMortgageHandoff",
  "request_payload",
  "response_payload",
  "GEMINI_API_KEY",
  "THIRDSTREAM_API_KEY",
  "EQUIFAX_API_KEY"
].forEach((forbidden) => {
  assert.equal(html.includes(forbidden), false, `${forbidden} should not appear in dashboard HTML`);
  assert.equal(js.includes(forbidden), false, `${forbidden} should not appear in dashboard JS`);
});

console.log("Dashboard AI credit browser checks passed.");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}
