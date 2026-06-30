const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = read("public/dashboard.html");
const js = read("public/assets/js/dashboard.js");
const auth = read("public/assets/js/auth.js");
const main = read("public/assets/js/main.js");

[
  "dashboardStateTitle",
  "dashboardAccountCard",
  "dashboardOnboardingCard",
  "dashboardCalculatorCard",
  "dashboardCalculatorRun",
  "dashboardCalculatorResult",
  "dashboardProfileName",
  "dashboardOnboardingGoal",
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
  "ensureDashboardLink",
  "dashboard.html",
  "js-auth-dashboard",
  "js-auth-credit",
  "js-auth-mortgage",
  "credit-profile.html",
  "mortgage.html",
  "nav.dashboard",
  "dashLink.hidden = !user"
].forEach((required) => {
  assert.equal(main.includes(required), true, `${required} is missing from signed-in nav`);
});

[
  "renderProfile",
  "renderOnboarding",
  "buildDashboardCalculatorPayload",
  "runDashboardCalculator",
  "requestMortgage",
  "AI calculator estimate",
  "Affordability / buying power estimate",
  "Estimated monthly payment range",
  "Down payment / available funds insight",
  "Rental / investment signal",
  "Key assumptions",
  "Risks / missing information",
  "Estimate only. Not financial, mortgage, legal, tax, or approval advice.",
  "normalizeOnboardingFallback",
  "fetchOnboardingProfile",
  "Not added yet",
  "Please sign in to view your dashboard.",
  "readinessScore",
  "riskLevel",
  "locationPreferences",
  "propertyPreferences",
  "budgetMin",
  "budgetMax",
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
  "rawProviderPayload",
  "rawModelPayload",
  "GEMINI_API_KEY",
  "THIRDSTREAM_API_KEY",
  "EQUIFAX_API_KEY"
].forEach((forbidden) => {
  assert.equal(html.includes(forbidden), false, `${forbidden} should not appear in dashboard HTML`);
  assert.equal(js.includes(forbidden), false, `${forbidden} should not appear in dashboard JS`);
  assert.equal(main.includes(forbidden), false, `${forbidden} should not appear in main nav JS`);
});

[
  "pre-approval",
  "preapproval",
  "guaranteed financing",
  "guaranteed lender acceptance"
].forEach((forbidden) => {
  assert.equal(html.includes(forbidden), false, `${forbidden} should not appear in dashboard HTML`);
  assert.equal(js.includes(forbidden), false, `${forbidden} should not appear in dashboard JS`);
});

console.log("Dashboard AI credit browser checks passed.");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}
