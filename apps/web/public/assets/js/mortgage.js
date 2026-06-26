(function () {
  "use strict";

  var form = document.getElementById("mortgageForm");
  if (!form) return;

  var submitButton = document.getElementById("mortgageSubmit");
  var submitStatus = document.getElementById("mortgageSubmitStatus");
  var errorBox = document.getElementById("mortgageFormErrors");
  var results = document.getElementById("mortgageResults");
  var referenceTitle = document.getElementById("mortgageReferenceTitle");
  var referenceMessage = document.getElementById("mortgageReferenceMessage");
  var activeCreditReference = null;

  function field(id) {
    return document.getElementById(id);
  }

  function textValue(id) {
    var input = field(id);
    return input && input.value ? input.value.trim() : "";
  }

  function parseMoney(id) {
    var raw = textValue(id);
    if (!raw) return null;
    var normalized = raw.toLowerCase().replace(/[$,\s]/g, "");
    var multiplier = normalized.endsWith("k") ? 1000 : 1;
    var number = Number(normalized.replace(/k$/, ""));
    return Number.isFinite(number) ? number * multiplier : null;
  }

  function markInvalid(id, invalid) {
    var input = field(id);
    if (!input) return;
    if (invalid) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function validate() {
    var errors = [];
    form.querySelectorAll("[aria-invalid='true']").forEach(function (input) {
      input.removeAttribute("aria-invalid");
    });

    [
      ["mortgagePurchasePrice", "Enter a target purchase price."],
      ["mortgageDownPayment", "Enter a down payment."],
      ["mortgageAnnualIncome", "Enter annual gross income."],
      ["mortgageMonthlyDebt", "Enter monthly debt payments, including 0 when there are none."],
      ["mortgageInterestRate", "Enter an interest rate assumption."],
      ["mortgageAmortizationYears", "Enter amortization years."]
    ].forEach(function (item) {
      if (parseMoney(item[0]) === null) {
        errors.push(item[1]);
        markInvalid(item[0], true);
      }
    });

    if (!textValue("mortgageLocation")) {
      errors.push("Enter a target location.");
      markInvalid("mortgageLocation", true);
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

  function compact(object) {
    return Object.keys(object).reduce(function (result, key) {
      if (object[key] !== undefined && object[key] !== null && object[key] !== "") {
        result[key] = object[key];
      }
      return result;
    }, {});
  }

  function buildPayload() {
    var payload = compact({
      targetPurchasePrice: parseMoney("mortgagePurchasePrice"),
      downPayment: parseMoney("mortgageDownPayment"),
      availableFunds: parseMoney("mortgageAvailableFunds"),
      location: textValue("mortgageLocation"),
      timeline: textValue("mortgageTimeline"),
      employmentType: textValue("mortgageEmploymentType"),
      employmentStability: textValue("mortgageEmploymentStability"),
      propertyType: textValue("mortgagePropertyType"),
      income: compact({
        annualGross: parseMoney("mortgageAnnualIncome"),
        employmentType: textValue("mortgageEmploymentType"),
        stability: textValue("mortgageEmploymentStability")
      }),
      debt: compact({
        totalBalance: parseMoney("mortgageDebtBalance"),
        monthlyPayments: parseMoney("mortgageMonthlyDebt")
      }),
      assumptions: compact({
        interestRate: parseMoney("mortgageInterestRate"),
        amortizationYears: parseMoney("mortgageAmortizationYears")
      })
    });

    if (activeCreditReference && activeCreditReference.creditAssessmentId) {
      payload.creditAssessmentId = activeCreditReference.creditAssessmentId;
    }

    return payload;
  }

  function safeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function safeText(value, fallback) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  function safeList(value) {
    return Array.isArray(value)
      ? value.filter(function (item) { return typeof item === "string" && item.trim(); }).slice(0, 20)
      : [];
  }

  function humanize(value) {
    return safeText(value, "Unknown")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function setText(id, text) {
    var element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function renderList(id, values, fallback) {
    var list = document.getElementById(id);
    list.replaceChildren();
    (values.length ? values : [fallback]).forEach(function (text) {
      var item = document.createElement("li");
      item.textContent = text;
      list.appendChild(item);
    });
  }

  function firstPaymentRange(reportData) {
    var scenarios = Array.isArray(reportData.loanScenarios) ? reportData.loanScenarios : [];
    var payments = scenarios
      .map(function (scenario) { return scenario.estimatedMonthlyPayment; })
      .filter(function (value) { return typeof value === "number" && Number.isFinite(value); });

    if (!payments.length) return "—";
    return formatMoney(Math.min.apply(Math, payments)) + "–" + formatMoney(Math.max.apply(Math, payments)) + "/mo";
  }

  function affordabilityRange(reportData) {
    var range = safeObject(reportData.estimatedBudgetRange);
    var conservative = safeText(range.conservative, "");
    var stretch = safeText(range.stretch, "");
    if (conservative && stretch) return conservative + "–" + stretch;
    return safeText(range.target, "—");
  }

  function formatMoney(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0
    }).format(Math.round(value));
  }

  function normalizeResult(response) {
    var source = safeObject(response);
    var reportData = safeObject(source.reportData);
    var creditReferenceStatus = safeObject(reportData.creditReferenceStatus || reportData.creditAssessmentResolution);

    return {
      summary: safeText(source.summary, "No mortgage summary was returned."),
      score: typeof source.score === "number" && Number.isFinite(source.score) ? source.score : null,
      riskLevel: safeText(source.riskLevel, "unknown"),
      affordabilityRange: affordabilityRange(reportData),
      paymentRange: firstPaymentRange(reportData),
      keyInsights: safeList(source.keyInsights),
      recommendations: safeList(source.recommendations),
      nextSteps: safeList(reportData.nextBestActions),
      creditReferenceStatus: creditReferenceStatus,
      disclaimer: safeText(source.disclaimer, "This estimate is informational and is not lender approval.")
    };
  }

  function renderResult(response) {
    var result = normalizeResult(response);
    var referenceStatus = safeText(result.creditReferenceStatus.status, "not_used");
    var referenceWarning = safeText(result.creditReferenceStatus.warning, "");

    setText("mortgageResultSummary", result.summary);
    setText("mortgageResultScore", result.score === null ? "—" : String(result.score));
    setText("mortgageRiskLevel", humanize(result.riskLevel));
    setText("mortgageAffordabilityRange", result.affordabilityRange);
    setText("mortgagePaymentRange", result.paymentRange);
    setText("mortgageCreditReferenceStatus", humanize(referenceWarning || referenceStatus));
    setText("mortgageDisclaimer", result.disclaimer);
    renderList("mortgageInsights", result.keyInsights, "No additional insights were returned.");
    renderList("mortgageRecommendations", result.recommendations, "No additional recommendations were returned.");
    renderList("mortgageNextSteps", result.nextSteps, "No next steps were returned.");

    if (referenceWarning === "credit_assessment_not_found_or_expired" && window.KIMURE_AUTH) {
      window.KIMURE_AUTH.clearCreditAssessmentReference();
      activeCreditReference = null;
      updateReferenceMessage();
    }

    results.hidden = false;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setLoading(loading) {
    submitButton.disabled = loading;
    submitButton.textContent = loading ? "Generating…" : "Generate mortgage estimate";
  }

  function updateReferenceMessage() {
    if (activeCreditReference) {
      referenceTitle.textContent = "Recent credit-readiness reference found";
      referenceMessage.textContent = "Kimure will send only the saved reference ID to the API. Raw credit handoff data is not stored in the browser.";
    } else {
      referenceTitle.textContent = "No recent credit-readiness reference found";
      referenceMessage.textContent = "This estimate will use only the mortgage details entered here.";
    }
  }

  async function loadReference() {
    if (!window.KIMURE_AUTH) {
      activeCreditReference = null;
      updateReferenceMessage();
      return;
    }

    if (window.KIMURE_AUTH.getCurrentUser) {
      await window.KIMURE_AUTH.getCurrentUser();
    }

    activeCreditReference = window.KIMURE_AUTH.getCreditAssessmentReference
      ? window.KIMURE_AUTH.getCreditAssessmentReference()
      : null;
    updateReferenceMessage();
  }

  async function updateAuthStatus() {
    if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.getCurrentUser) return;
    var user = await window.KIMURE_AUTH.getCurrentUser();
    submitStatus.textContent = user
      ? "Signed in. Your estimate will be sent securely through the Kimure API."
      : "Sign in to request an estimate.";
  }

  document.addEventListener("kimure-auth-changed", function () {
    loadReference();
    updateAuthStatus();
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var errors = validate();
    renderErrors(errors);
    if (errors.length) return;

    if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.requestMortgage) {
      renderErrors(["The Kimure API client is not available on this page."]);
      return;
    }

    activeCreditReference = window.KIMURE_AUTH.getCreditAssessmentReference
      ? window.KIMURE_AUTH.getCreditAssessmentReference()
      : null;
    updateReferenceMessage();

    var payload = buildPayload();

    setLoading(true);
    submitStatus.textContent = activeCreditReference
      ? "Sending mortgage details with a saved credit-readiness reference…"
      : "Sending mortgage details without a recent credit-readiness reference…";
    var response = await window.KIMURE_AUTH.requestMortgage(payload);
    setLoading(false);

    if (!response.ok) {
      renderErrors([response.message || "The mortgage estimate could not be completed."]);
      submitStatus.textContent = response.needsLogin
        ? "Sign in to request an estimate."
        : "Mortgage request failed.";
      return;
    }

    renderErrors([]);
    renderResult(response.data);
    submitStatus.textContent = "Mortgage estimate complete.";
  });

  loadReference();
  updateAuthStatus();
})();
