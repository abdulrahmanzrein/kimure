const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "public/marketplace.html"), "utf8");
const js = fs.readFileSync(
  path.join(root, "public/assets/js/marketplace.js"),
  "utf8"
);

[
  "marketplace-ai-tools",
  'data-ai-tool="scout"',
  'data-ai-tool="analyze"',
  'data-ai-tool="rental"',
  'data-ai-tool="valuate"',
  'data-ai-tool="investment-planner"',
  'data-ai-tool="chat"',
  "credit-profile.html",
  "mortgage.html"
].forEach((required) => {
  assert.equal(html.includes(required), true, `${required} is missing`);
});

[
  '"/ai/" + encodeURIComponent(tool)',
  "Authorization: \"Bearer \" + token",
  "getApiBaseUrl()"
].forEach((required) => {
  assert.equal(js.includes(required), true, `${required} is missing`);
});

[
  "localhost:4000",
  "apps/ai-gateway",
  "GEMINI_API_KEY",
  "sourceResponse:",
  "contentBase64:",
  "JSON.stringify(aiResponse.data)"
].forEach((forbidden) => {
  assert.equal(js.includes(forbidden), false, `${forbidden} should not appear`);
});

console.log("Marketplace AI tools checks passed.");
