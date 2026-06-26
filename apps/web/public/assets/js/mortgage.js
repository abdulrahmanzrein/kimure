(function () {
  "use strict";

  var form = document.getElementById("mortgageForm");
  if (!form) return;

  var submitButton = document.getElementById("mortgageSubmit");
  var submitStatus = document.getElementById("mortgageSubmitStatus");
  var referenceNote = document.getElementById("mortgageReferenceNote");
  var errorBox = document.getElementById("mortgageFormErrors");
  var results = document.getElementById("mortgageResults");

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

  function compact(object) {
    return Object.keys(object).reduce(function (result, key) {
      if (object[key] !== undefined && object[key] !== "") result[key] = object[key];
      return result;
    }, {});
  }

  function buildPayload() {
    return compact({
      targetPurchasePrice: numberValue("mortgageTargetPrice"),
      downPayment: numberValue("mortgageDownPayment"),
      availableFunds: numberValue("mortgageAvailableFunds"),
      location: value("mortgageLocation"),
      timeline: value("mortgageTimeline"),
      income: compact({
        annualGross: numberValue("mortgageAnnualIncome"),
        employmentType: value("mortgageEmploymentType"),
        stability: value("mortgageEmploymentStability")
      }),
      debt: compact({
        totalBalance: numberValue("mortgageTotalDebt"),
        monthlyPayments: numberValue("mortgageMonthlyDebt")
      }),
      assumptions: compact({
        interestRate: numberValue("mortgageInterestRate"),
        amortizationYears: numberValue("mortgageAmortization")
      }),
      propertyType: value("mortgagePropertyType")
    });
  }

  function markInvalid(id) {
    var field = document.getElementById(id);
    if (field) field.setAttribute("aria-invalid", "true");
  }

  function validate() {
    var errors = [];
    form.querySelectorAll("[aria-invalid='true']").forEach(function (field) {
      field.removeAttribute("aria-invalid");
    });

    var requiredPositive = [
      ["mortgageTargetPrice", "Enter a target purchase price greater than zero."],
      ["mortgageAnnualIncome", "Enter annual gross income greater than zero."],
      ["mortgageInterestRate", "Enter an interest-rate assumption greater than zero."],
      ["mortgageAmortization", "Select an amortization period."]
    ];
    requiredPositive.forEach(function (entry) {
      var number = numberValue(entry[0]);
      if (number === undefined || number <= 0) {
        errors.push(entry[1]);
        markInvalid(entry[0]);
      }
    });

    [
      ["mortgageDownPayment", "Enter a down payment, including 0 when applicable."],
      ["mortgageMonthlyDebt", "Enter monthly debt payments, including 0 when there are none."]
    ].forEach(function (entry) {
      var number = numberValue(entry[0]);
      if (number === undefined || number < 0) {
        errors.push(entry[1]);
        markInvalid(entry[0]);
      }
    });

    var targetPrice = numberValue("mortgageTargetPrice");
    var downPayment = numberValue("mortgageDownPayment");
    if (targetPrice !== undefined && downPayment !== undefined && downPayment > targetPrice) {
      errors.push("Down payment cannot exceed the target purchase price.");
      markInvalid("mortgageDownPayment");
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

  function safeNumber(valueToCheck) {
    return typeof valueToCheck === "number" && Number.isFinite(valueToCheck)
      ? valueToCheck
      : null;
  }

  function safeList(valueToCheck) {
    return Array.isArray(valueToCheck)
      ? valueToCheck.filter(function (item) { return typeof item === "string" && item.trim(); }).slice(0, 20)
      : [];
  }

  function normalizeResponse(response) {
    var source = safeObject(response);
    var reportData = safeObject(source.reportData);
    var budgetRange = safeObject(reportData.estimatedBudgetRange);
    var maximumMortgage = safeObject(reportData.maximumMortgageEstimate);
    var paymentAssumptions = safeObject(reportData.paymentAssumptions);
    var creditResolution = safeObject(reportData.creditAssessmentResolution);
    var payments = Array.isArray(reportData.loanScenarios)
      ? reportData.loanScenarios.map(function (scenario) {
        return safeNumber(safeObject(scenario).estimatedMonthlyPayment);
      }).filter(function (payment) { return payment !== null; })
      : [];
    var warningFlags = safeList(reportData.warningFlags)
      .concat(safeList(reportData.affordabilityWarningFlags))
      .slice(0, 20);
    var referenceWarning = safeText(creditResolution.warning, null);
    if (referenceWarning && warningFlags.indexOf(referenceWarning) === -1) {
      warningFlags.push(referenceWarning);
    }

    return {
      summary: safeText(source.summary, "No mortgage summary was returned."),
      riskLevel: safeText(source.riskLevel, "unknown"),
      keyInsights: safeList(source.keyInsights),
      recommendations: safeList(source.recommendations),
      affordability: {
        conservative: safeText(budgetRange.conservative, null),
        target: safeText(budgetRange.target, null),
        stretch: safeText(budgetRange.stretch, null),
        maximumMortgage: safeNumber(maximumMortgage.amount)
      },
      payments: payments,
      estimatedMonthlyPayment: safeNumber(paymentAssumptions.estimatedMonthlyPayment),
      warningFlags: warningFlags,
      creditReferenceStatus: safeText(creditResolution.status, "not_provided"),
      creditReferenceWarning: referenceWarning,
      disclaimer: safeText(source.disclaimer, "This estimate is informational and is not lender approval.")
    };
  }

  function formatCurrency(number) {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0
    }).format(number);
  }

  function formatAffordability(affordability) {
    if (affordability.conservative && affordability.stretch) {
      return affordability.conservative + " – " + affordability.stretch;
    }
    if (affordability.target) return affordability.target;
    if (affordability.maximumMortgage !== null) return formatCurrency(affordability.maximumMortgage);
    return "Not available";
  }

  function formatPaymentRange(result) {
    var payments = result.payments.slice();
    if (result.estimatedMonthlyPayment !== null) payments.push(result.estimatedMonthlyPayment);
    if (!payments.length) return "Not available";
    var minimum = Math.min.apply(Math, payments);
    var maximum = Math.max.apply(Math, payments);
    return minimum === maximum
      ? formatCurrency(minimum) + "/month"
      : formatCurrency(minimum) + " – " + formatCurrency(maximum) + "/month";
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

  function isExpiredReference(result) {
    return result.creditReferenceStatus === "not_found_or_expired" ||
      result.creditReferenceWarning === "credit_assessment_not_found_or_expired";
  }

  function renderResult(response) {
    var result = normalizeResponse(response);

    if (isExpiredReference(result) && window.KIMURE_AUTH && window.KIMURE_AUTH.clearCreditAssessmentReference) {
      window.KIMURE_AUTH.clearCreditAssessmentReference();
      referenceNote.textContent = "The recent credit-readiness reference expired. This estimate uses only the mortgage details entered here.";
    }

    setText("mortgageResultSummary", result.summary);
    setText("mortgageResultRisk", humanize(result.riskLevel));
    setText("mortgageAffordability", formatAffordability(result.affordability));
    setText("mortgagePaymentRange", formatPaymentRange(result));
    setText("mortgageReferenceStatus", humanize(result.creditReferenceStatus));
    setText("mortgageResultDisclaimer", result.disclaimer);
    renderList("mortgageResultInsights", result.keyInsights, "No additional insights were returned.");
    renderList("mortgageResultRecommendations", result.recommendations, "No additional recommendations were returned.");
    renderList(
      "mortgageResultWarnings",
      result.warningFlags.map(humanize),
      "No warning flags were returned."
    );

    results.hidden = false;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setLoading(loading) {
    submitButton.disabled = loading;
    submitButton.textContent = loading ? "Generating…" : "Generate mortgage estimate";
  }

  async function loadReference() {
    if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.getCreditAssessmentReference) return null;
    var reference = await window.KIMURE_AUTH.getCreditAssessmentReference();
    referenceNote.textContent = reference
      ? "A recent credit-readiness reference is available for this estimate."
      : "No recent credit-readiness reference found. This estimate will use only the mortgage details entered here.";
    return reference;
  }

  async function updateAuthStatus() {
    if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.getCurrentUser) return;
    var user = await window.KIMURE_AUTH.getCurrentUser();
    submitStatus.textContent = user
      ? "Signed in. Your request will be sent securely through the Kimure API."
      : "Sign in to submit an estimate.";
    await loadReference();
  }

  document.addEventListener("kimure-auth-changed", updateAuthStatus);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var errors = validate();
    renderErrors(errors);
    if (errors.length) return;

    if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.requestMortgage) {
      renderErrors(["The Kimure API client is not available on this page."]);
      return;
    }

    var payload = buildPayload();
    var reference = await loadReference();
    if (reference) payload.creditAssessmentId = reference.creditAssessmentId;

    setLoading(true);
    submitStatus.textContent = "Sending a secure request to the Kimure API…";
    var response = await window.KIMURE_AUTH.requestMortgage(payload);
    setLoading(false);

    if (!response.ok) {
      if (response.creditReferenceExpired && window.KIMURE_AUTH.clearCreditAssessmentReference) {
        window.KIMURE_AUTH.clearCreditAssessmentReference();
        referenceNote.textContent = "The recent credit-readiness reference expired. Submit again to estimate using only the mortgage details entered here.";
      }
      renderErrors([response.message || "The mortgage estimate could not be completed."]);
      submitStatus.textContent = response.needsLogin
        ? "Sign in to submit an estimate."
        : "Mortgage estimate request failed.";
      return;
    }

    renderErrors([]);
    renderResult(response.data);
    submitStatus.textContent = "Mortgage estimate complete.";
  });

  updateAuthStatus();
})();
