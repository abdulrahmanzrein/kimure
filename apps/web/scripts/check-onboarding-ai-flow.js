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

assert.equal(js.includes("handleAiRecommendationStep"), true);
assert.equal(js.includes("runAiRecommendationFlow"), true);
assert.equal(js.includes("Generating AI matches"), true);
assert.equal(js.includes("AI recommendations could not be generated right now. Please try again."), true);
assert.equal(js.includes("window.KIMURE_AUTH.requestAiTool"), true);
assert.equal(js.includes("window.KIMURE_AUTH.saveOnboardingProfile(form, null)"), true);
assert.equal(js.includes("if (current === 8)"), true);
assert.equal(js.indexOf("if (current === 8)") < js.indexOf("showStep(current + 1)"), true);
assert.equal(js.includes("aiRecommendationReady"), true);
assert.equal(js.includes("showStep(9)"), true);
assert.equal(js.includes("renderAiRecommendationCard"), true);
assert.equal(js.includes("metadata: {\n          source: \"smart_onboarding\""), true);
const aiPayloadBuilder = js.slice(
  js.indexOf("function buildOnboardingAiPayload"),
  js.indexOf("function setAiStatus")
);
assert.equal(aiPayloadBuilder.includes("password"), false, "onboarding AI payload should not reference password fields");
assert.equal(aiPayloadBuilder.includes("email"), false, "onboarding AI payload should not send email");
assert.equal(aiPayloadBuilder.includes("phone"), false, "onboarding AI payload should not send phone");
assert.equal(js.includes("Authorization"), false);
assert.equal(js.includes("Bearer "), false);
assert.equal(js.includes("localhost:4000"), false);
assert.equal(js.includes("ai-gateway"), false);
assert.equal(js.includes("sourceResponse"), false);
assert.equal(js.includes("contentBase64"), false);

assert.equal(auth.includes("function requestAiTool"), true);
assert.equal(auth.includes("getApiBaseUrl() + \"/ai/\" + safeTool"), true);
assert.equal(auth.includes("Authorization: \"Bearer \" + token"), true);
assert.equal(auth.includes("localhost:4000"), false);
assert.equal(auth.includes("GEMINI_API_KEY"), false);
assert.equal(auth.includes("sourceResponse"), false);
assert.equal(auth.includes("contentBase64"), false);

assert.equal(css.includes(".onb-ai-status"), true);
assert.equal(css.includes(".onb-ai-result-card"), true);

console.log("Onboarding AI flow check passed.");
