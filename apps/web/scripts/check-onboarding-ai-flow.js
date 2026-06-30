const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const webRoot = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(webRoot, "public/onboarding-form.html"), "utf8");
const js = fs.readFileSync(path.join(webRoot, "public/assets/js/onboarding-form.js"), "utf8");
const auth = fs.readFileSync(path.join(webRoot, "public/assets/js/auth.js"), "utf8");
const css = fs.readFileSync(path.join(webRoot, "public/assets/css/onboarding.css"), "utf8");

assert.equal(html.includes("Step 8 — AI Recommendation"), true);
assert.equal(html.includes("Get My AI Matches"), false, "button label is controlled by JS/i18n");
assert.equal(html.includes("onbAiStatus"), true);
assert.equal(html.includes("onbAiStep8Preview"), true);
assert.equal(html.includes("onbAiResultsPanel"), true);
assert.equal(html.includes("onbCalculatorRun"), true);
assert.equal(html.includes("onbCalculatorStatus"), true);
assert.equal(html.includes("onbCalculatorResult"), true);
assert.equal(html.includes("AI Mortgage Calculator"), true);
assert.equal(html.includes("This stays on Step 9"), true);

assert.equal(js.includes("handleAiRecommendationStep"), true);
assert.equal(js.includes("runAiRecommendationFlow"), true);
assert.equal(js.includes("Generating AI matches"), true);
assert.equal(js.includes("AI recommendations could not be generated right now. Please try again."), true);
assert.equal(js.includes("window.KIMURE_AUTH.requestAiTool"), true);
assert.equal(js.includes("window.KIMURE_AUTH.saveOnboardingProfile(form, null)"), true);
assert.equal(js.includes("runOnboardingCalculator"), true);
assert.equal(js.includes("buildOnboardingCalculatorPayload"), true);
assert.equal(js.includes("window.KIMURE_AUTH.requestMortgage"), true);
assert.equal(js.includes("renderOnboardingCalculatorResult"), true);
assert.equal(js.includes("AI Mortgage Calculator estimate"), true);
assert.equal(js.includes("expectedMonthlyRentalIncome"), true);
assert.equal(js.includes("investmentReturnGoal"), true);
assert.equal(js.includes("onboardingAiRecommendationSummary"), true);
assert.equal(js.includes("Affordability / buying power estimate"), true);
assert.equal(js.includes("Estimated monthly payment range"), true);
assert.equal(js.includes("Down payment / available funds insight"), true);
assert.equal(js.includes("Rental / investment signal"), true);
assert.equal(js.includes("Risks / missing information"), true);
assert.equal(js.includes("Estimate only. Not financial, mortgage, legal, tax, or approval advice."), true);
assert.equal(js.includes("Running AI calculator with your onboarding inputs"), true);
assert.equal(js.includes("Calculator estimate could not be generated right now. Please try again."), true);
assert.equal(js.includes("if (current === 8)"), true);
assert.equal(js.indexOf("if (current === 8)") < js.indexOf("showStep(current + 1)"), true);
assert.equal(js.includes("aiRecommendationReady"), true);
assert.equal(js.includes("showStep(9)"), true);
const calculatorRunner = js.slice(
  js.indexOf("async function runOnboardingCalculator"),
  js.indexOf("function isAlreadySignedIn")
);
assert.equal(calculatorRunner.includes("showStep(10)"), false, "calculator should not advance to Step 10");
assert.equal(calculatorRunner.includes("showStep(current + 1)"), false, "calculator should not use wizard next navigation");
assert.equal(js.includes("renderAiRecommendationCard"), true);
assert.equal(js.includes("metadata: {\n          source: \"smart_onboarding\""), true);
const aiPayloadBuilder = js.slice(
  js.indexOf("function buildOnboardingAiPayload"),
  js.indexOf("function setAiStatus")
);
assert.equal(aiPayloadBuilder.includes("password"), false, "onboarding AI payload should not reference password fields");
assert.equal(aiPayloadBuilder.includes("email"), false, "onboarding AI payload should not send email");
assert.equal(aiPayloadBuilder.includes("phone"), false, "onboarding AI payload should not send phone");
const calculatorPayloadBuilder = js.slice(
  js.indexOf("function buildOnboardingCalculatorPayload"),
  js.indexOf("function setCalculatorStatus")
);
assert.equal(calculatorPayloadBuilder.includes("password"), false, "calculator payload should not reference password fields");
assert.equal(calculatorPayloadBuilder.includes("email"), false, "calculator payload should not send email");
assert.equal(calculatorPayloadBuilder.includes("phone"), false, "calculator payload should not send phone");
assert.equal(js.includes("Authorization"), false);
assert.equal(js.includes("Bearer "), false);
assert.equal(js.includes("localhost:4000"), false);
assert.equal(js.includes("ai-gateway"), false);
assert.equal(js.includes("sourceResponse"), false);
assert.equal(js.includes("contentBase64"), false);
["pre-approval", "preapproval", "guaranteed financing", "guaranteed lender acceptance"].forEach((forbidden) => {
  assert.equal(html.includes(forbidden), false, `${forbidden} should not appear in onboarding HTML`);
  assert.equal(js.includes(forbidden), false, `${forbidden} should not appear in onboarding JS`);
});

assert.equal(auth.includes("function requestAiTool"), true);
assert.equal(auth.includes("getApiBaseUrl() + \"/ai/\" + safeTool"), true);
assert.equal(auth.includes("Authorization: \"Bearer \" + token"), true);
assert.equal(auth.includes("getApiBaseUrl() + \"/ai/mortgage\""), true);
assert.equal(auth.includes("localhost:4000"), false);
assert.equal(auth.includes("GEMINI_API_KEY"), false);
assert.equal(auth.includes("sourceResponse"), false);
assert.equal(auth.includes("contentBase64"), false);

assert.equal(css.includes(".onb-ai-status"), true);
assert.equal(css.includes(".onb-ai-result-card"), true);
assert.equal(css.includes(".onb-calculator-sections"), true);

console.log("Onboarding AI flow check passed.");
