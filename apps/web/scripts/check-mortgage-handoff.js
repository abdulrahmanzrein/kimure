const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const authJs = read("public/assets/js/auth.js");
const creditProfileHtml = read("public/credit-profile.html");
const creditProfileJs = read("public/assets/js/credit-profile.js");
const mortgageJs = read("public/assets/js/mortgage.js");
const mortgageHtml = read("public/mortgage.html");

assert.ok(authJs.includes("saveCreditAssessmentReference"));
assert.ok(authJs.includes("getCreditAssessmentReference"));
assert.ok(authJs.includes("clearCreditAssessmentReference"));
assert.ok(authJs.includes("window.sessionStorage.setItem"));
assert.ok(authJs.includes("window.sessionStorage.removeItem"));
assert.ok(authJs.includes("delete safePayload.creditMortgageHandoff"));
assert.ok(authJs.includes("delete safePayload.creditProfileContext"));
assert.ok(authJs.includes("delete safePayload.credit_profile_context"));

assert.ok(creditProfileJs.includes("creditAssessment.assessmentId"));
assert.ok(creditProfileJs.includes("creditAssessment.expiresAt"));
assert.ok(creditProfileJs.includes("saveCreditAssessmentReference"));
assert.equal(creditProfileJs.includes("creditMortgageHandoff"), false);
assert.equal(/creditAssessmentId=/.test(creditProfileHtml), false);

assert.equal(/creditAssessmentId=/.test(mortgageHtml), false);
assert.equal(/creditAssessmentId=/.test(mortgageJs), false);
assert.ok(mortgageJs.includes("payload.creditAssessmentId"));
assert.equal(mortgageJs.includes("creditMortgageHandoff:"), false);
assert.equal(mortgageJs.includes("creditProfileContext:"), false);
assert.equal(mortgageJs.includes("credit_profile_context:"), false);
assert.ok(mortgageJs.includes("getCreditAssessmentReference"));
assert.ok(mortgageJs.includes("clearCreditAssessmentReference"));
assert.ok(mortgageJs.includes("credit_assessment_not_found_or_expired"));

console.log("Mortgage handoff browser checks passed.");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}
