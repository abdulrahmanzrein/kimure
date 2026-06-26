(function () {
  "use strict";

  var form = document.getElementById("creditProfileForm");
  if (!form) return;

  var assessmentType = document.getElementById("creditAssessmentType");
  var bureauField = document.getElementById("creditBureauField");
  var bureauChoice = document.getElementById("creditBureauChoice");
  var providerFields = document.getElementById("creditProviderFields");
  var modeNote = document.getElementById("creditModeNote");
  var submitButton = document.getElementById("creditSubmit");
  var submitStatus = document.getElementById("creditSubmitStatus");
  var errorBox = document.getElementById("creditFormErrors");
  var results = document.getElementById("creditResults");
  var sinInput = document.getElementById("creditSin");
  var creditAssessmentId = null;
  var bureauOptions = Object.freeze({
    equifax: { label: "Equifax", providerChoice: "thirdstream_equifax" },
    transunion: { label: "TransUnion", providerChoice: "thirdstream_transunion" }
  });

  var requiredProviderFields = [
    "creditFirstName",
    "creditLastName",
    "creditDateOfBirth",
    "creditCivicNumber",
    "creditStreetName",
    "creditCity",
    "creditProvinceCode",
    "creditPostalCode",
    "creditBureauConsent"
  ];

  function isProviderMode() {
    return assessmentType.value === "bureau";
  }

  function getProviderChoice() {
    if (!isProviderMode()) return "directional";
    var bureau = bureauOptions[bureauChoice.value];
    return bureau ? bureau.providerChoice : "";
  }

  function updateMode() {
    var providerMode = isProviderMode();
    providerFields.hidden = !providerMode;
    bureauField.hidden = !providerMode;
    bureauChoice.disabled = !providerMode;
    bureauChoice.required = providerMode;
    if (!providerMode && sinInput) sinInput.value = "";

    providerFields.querySelectorAll("[data-provider-field]").forEach(function (field) {
      field.disabled = !providerMode;
    });
    requiredProviderFields.forEach(function (id) {
      var field = document.getElementById(id);
      if (field) field.required = providerMode;
    });

    modeNote.textContent = providerMode
      ? "A bureau-verified check requires identity details, current address, explicit consent, and provider access."
      : "Informational guidance only. This does not pull a bureau report or provide your actual credit score.";
  }

  function value(id) {
    var field = document.getElementById(id);
    return field && field.value ? field.value.trim() : "";
  }

  function numberValue(id) {
    var raw = value(id);
    if (raw === "") return undefined;
    var number = Number(raw);
    return Number.isFinite(number) ? number : undefined;
  }

  function booleanValue(id) {
    var raw = value(id);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return undefined;
  }

  function compact(object) {
    return Object.keys(object).reduce(function (result, key) {
      if (object[key] !== undefined && object[key] !== "") {
        result[key] = object[key];
      }
      return result;
    }, {});
  }

  function buildPayload() {
    var payload = {
      providerChoice: getProviderChoice(),
      financialProfile: compact({
        annualIncome: numberValue("creditAnnualIncome"),
        monthlyDebt: numberValue("creditMonthlyDebt"),
        employmentStatus: value("creditEmploymentStatus"),
        employmentStability: value("creditEmploymentStability"),
        currentHousingPayment: numberValue("creditHousingPayment"),
        savings: numberValue("creditSavings"),
        downPayment: numberValue("creditDownPayment"),
        targetPurchasePrice: numberValue("creditPurchasePrice"),
        timeline: value("creditTimeline"),
        location: value("creditLocation"),
        firstTimeBuyer: booleanValue("creditFirstTimeBuyer"),
        riskTolerance: value("creditRiskTolerance")
      })
    };

    if (!isProviderMode()) return payload;

    var consentTimestamp = new Date().toISOString();
    payload.identity = compact({
      firstName: value("creditFirstName"),
      middleName: value("creditMiddleName"),
      lastName: value("creditLastName"),
      dateOfBirth: value("creditDateOfBirth"),
      phoneNumber: value("creditPhoneNumber"),
      socialInsuranceNumber: value("creditSin")
    });
    payload.currentAddress = compact({
      unitNumber: value("creditUnitNumber"),
      civicNumber: value("creditCivicNumber"),
      streetName: value("creditStreetName"),
      city: value("creditCity"),
      provinceCode: value("creditProvinceCode"),
      postalCode: value("creditPostalCode").toUpperCase()
    });
    payload.consent = {
      creditConsent: true,
      consentGiven: true,
      bureauConsent: true,
      permissiblePurpose: "credit_profile_assessment",
      consentTimestamp: consentTimestamp,
      consentVersion: "kimure-credit-profile-v1"
    };

    return payload;
  }

  function markInvalid(id, invalid) {
    var field = document.getElementById(id);
    if (!field) return;
    if (invalid) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  }

  function validate() {
    var errors = [];
    form.querySelectorAll("[aria-invalid='true']").forEach(function (field) {
      field.removeAttribute("aria-invalid");
    });

    var annualIncome = numberValue("creditAnnualIncome");
    var monthlyDebt = numberValue("creditMonthlyDebt");
    if (annualIncome === undefined || annualIncome <= 0) {
      errors.push("Enter annual income greater than zero.");
      markInvalid("creditAnnualIncome", true);
    }
    if (monthlyDebt === undefined || monthlyDebt < 0) {
      errors.push("Enter monthly debt payments, including 0 when there are none.");
      markInvalid("creditMonthlyDebt", true);
    }

    if (isProviderMode()) {
      if (!bureauChoice.value) {
        errors.push("Select Equifax or TransUnion for a bureau-verified check.");
        markInvalid("creditBureauChoice", true);
      }

      requiredProviderFields.slice(0, -1).forEach(function (id) {
        if (!value(id)) {
          errors.push(document.querySelector("label[for='" + id + "']").textContent.trim() + " is required for a bureau-verified check.");
          markInvalid(id, true);
        }
      });

      var consent = document.getElementById("creditBureauConsent");
      if (!consent.checked) {
        errors.push("Explicit bureau consent is required for a bureau-verified check.");
        markInvalid("creditBureauConsent", true);
      }
    }

    return errors;
  }

  function renderErrors(errors) {
    errorBox.replaceChildren();
    errorBox.hidden = errors.length === 0;
    if (!errors.length) return;

    var list = document.createElement("ul");
    errors.forEach(function (message) {
      var item = document.createElement("li");
      item.textContent = message;
      list.appendChild(item);
    });
    errorBox.appendChild(list);
  }

  function safeObject(valueToCheck) {
    return valueToCheck && typeof valueToCheck === "object" && !Array.isArray(valueToCheck)
      ? valueToCheck
      : {};
  }

  function safeText(valueToCheck, fallback) {
    return typeof valueToCheck === "string" && valueToCheck.trim()
      ? valueToCheck.trim()
      : fallback;
  }

  function safeList(valueToCheck) {
    return Array.isArray(valueToCheck)
      ? valueToCheck.filter(function (item) { return typeof item === "string" && item.trim(); }).slice(0, 20)
      : [];
  }

  // Apply a second frontend allowlist even though apps/api already shapes the response.
  function normalizeResponse(response) {
    var source = safeObject(response);
    var reportData = safeObject(source.reportData);
    var providerStatus = safeObject(reportData.providerStatus);
    var verificationStatus = safeObject(reportData.verificationStatus);
    var creditAssessment = safeObject(reportData.creditAssessment);

    return {
      summary: safeText(source.summary, "No summary was returned."),
      score: typeof source.score === "number" && Number.isFinite(source.score) ? source.score : null,
      riskLevel: safeText(source.riskLevel, "unknown"),
      keyInsights: safeList(source.keyInsights),
      recommendations: safeList(source.recommendations),
      providerStatus: {
        status: safeText(providerStatus.status, "not_connected")
      },
      verificationStatus: {
        status: safeText(verificationStatus.status, "directional_only")
      },
      missingFields: safeList(reportData.missingFields),
      disclaimer: safeText(source.disclaimer, "This assessment is informational and is not lender approval."),
      creditAssessmentId: safeText(creditAssessment.assessmentId, null),
      creditAssessmentExpiresAt: safeText(creditAssessment.expiresAt, null)
    };
  }

  function humanize(valueToCheck) {
    return safeText(valueToCheck, "Unknown")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function setText(id, text) {
    var element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function getBureauLabel() {
    if (!isProviderMode()) return "Not used";
    var bureau = bureauOptions[bureauChoice.value];
    return bureau ? bureau.label : "Not selected";
  }

  function renderList(id, items, emptyMessage) {
    var list = document.getElementById(id);
    list.replaceChildren();
    var values = items.length ? items : [emptyMessage];
    values.forEach(function (text) {
      var item = document.createElement("li");
      item.textContent = text;
      list.appendChild(item);
    });
  }

  function renderResult(response) {
    var result = normalizeResponse(response);
    creditAssessmentId = result.creditAssessmentId;

    setText("creditResultSummary", result.summary);
    setText("creditResultScore", result.score === null ? "—" : String(result.score));
    setText("creditResultRisk", humanize(result.riskLevel));
    setText(
      "creditProviderStatus",
      getBureauLabel() + " · " + humanize(result.providerStatus.status)
    );
    setText("creditVerificationStatus", humanize(result.verificationStatus.status));
    setText("creditResultDisclaimer", result.disclaimer);
    renderList("creditResultInsights", result.keyInsights, "No additional insights were returned.");
    renderList("creditResultRecommendations", result.recommendations, "No additional recommendations were returned.");
    renderList("creditResultMissing", result.missingFields, "No missing fields were identified.");
    updateMortgageContinue(result);

    results.hidden = false;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function updateMortgageContinue(result) {
    var continueRow = document.getElementById("creditMortgageContinue");
    var continueStatus = document.getElementById("creditMortgageContinueStatus");
    if (!continueRow || !continueStatus) return;

    continueRow.hidden = true;
    continueStatus.textContent = "";
    if (!result.creditAssessmentId || !result.creditAssessmentExpiresAt) return;
    if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.saveCreditAssessmentReference) return;

    var user = window.KIMURE_AUTH.getCurrentUser
      ? await window.KIMURE_AUTH.getCurrentUser()
      : null;
    if (!user || !user.id) return;

    var saved = window.KIMURE_AUTH.saveCreditAssessmentReference({
      creditAssessmentId: result.creditAssessmentId,
      expiresAt: result.creditAssessmentExpiresAt,
      userId: user.id
    });

    if (saved) {
      continueStatus.textContent = "A recent credit-readiness reference is saved for this session.";
      continueRow.hidden = false;
    }
  }

  function setLoading(loading) {
    submitButton.disabled = loading;
    submitButton.textContent = loading ? "Generating…" : "Generate assessment";
  }

  async function updateAuthStatus() {
    if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.getCurrentUser) return;
    var user = await window.KIMURE_AUTH.getCurrentUser();
    submitStatus.textContent = user
      ? "Signed in. Your request will be sent securely through the Kimure API."
      : "Sign in to submit an assessment.";
  }

  assessmentType.addEventListener("change", updateMode);
  document.addEventListener("kimure-auth-changed", updateAuthStatus);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var errors = validate();
    renderErrors(errors);
    if (errors.length) return;

    if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.requestCreditProfile) {
      renderErrors(["The Kimure API client is not available on this page."]);
      return;
    }

    var payload = buildPayload();
    if (sinInput) sinInput.value = "";

    setLoading(true);
    submitStatus.textContent = "Sending a secure request to the Kimure API…";
    var response = await window.KIMURE_AUTH.requestCreditProfile(payload);
    setLoading(false);

    if (!response.ok) {
      renderErrors([response.message || "The assessment could not be completed."]);
      submitStatus.textContent = response.needsLogin
        ? "Sign in to submit an assessment."
        : "Assessment request failed.";
      return;
    }

    renderErrors([]);
    renderResult(response.data);
    submitStatus.textContent = "Assessment complete.";
  });

  window.KIMURE_CREDIT_PROFILE = Object.freeze({
    getMortgageReference: function () {
      return creditAssessmentId ? { creditAssessmentId: creditAssessmentId } : null;
    },
    clear: function () {
      creditAssessmentId = null;
    }
  });

  updateMode();
  updateAuthStatus();
})();
