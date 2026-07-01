(function () {
  "use strict";

  var stateTitle = document.getElementById("dashboardStateTitle");
  if (!stateTitle) return;

  // Role-based redirect: if the logged-in user is a partner or admin, send them
  // to their own dashboard instead of the individual one.
  (async function redirectByRole() {
    if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.getSupabaseClient) return;
    var client = window.KIMURE_AUTH.getSupabaseClient();
    if (!client) return;
    var sessRes = await client.auth.getSession();
    var session = sessRes.data && sessRes.data.session;
    if (!session || !session.access_token) return;

    var cfg = window.KIMURE_SUPABASE_CONFIG;
    var apiBase = (cfg && cfg.apiBaseUrl) ? cfg.apiBaseUrl : "http://localhost:3001/api";

    try {
      var res = await fetch(apiBase + "/users/me", {
        headers: { "Authorization": "Bearer " + session.access_token }
      });
      var me = await res.json();

      if (me.role === "partner") {
        window.location.replace("partner-dashboard.html");
      } else if (me.role === "admin") {
        window.location.replace("admin-dashboard.html");
      }
    } catch (err) { /* stay on individual dashboard */ }
  })();

  var stateMessage = document.getElementById("dashboardStateMessage");
  var currentUser = null;
  var currentDashboard = null;

  function safeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function safeList(value) {
    return Array.isArray(value)
      ? value.filter(function (item) { return typeof item === "string" && item.trim(); }).slice(0, 12)
      : [];
  }

  function safeText(value, fallback) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  function safeNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function setText(id, text) {
    var element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function setCardTitle(cardId, title) {
    var card = document.getElementById(cardId);
    var heading = card ? card.querySelector("h2") : null;
    if (heading) heading.textContent = title;
  }

  function displayText(value) {
    return safeText(value, "Not added yet");
  }

  function humanize(value, fallback) {
    return safeText(value, fallback || "—")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
  }

  function formatMoney(value) {
    var number = safeNumber(value);
    if (number === null) return "—";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0
    }).format(Math.round(number));
  }

  function formatBudgetRange(min, max) {
    var minNumber = safeNumber(min);
    var maxNumber = safeNumber(max);
    if (minNumber === null && maxNumber === null) return "Not added yet";
    if (minNumber !== null && maxNumber !== null) return formatMoney(minNumber) + " – " + formatMoney(maxNumber);
    if (minNumber !== null) return formatMoney(minNumber) + "+";
    return "Up to " + formatMoney(maxNumber);
  }

  function formatDate(value) {
    var text = safeText(value, "");
    var time = Date.parse(text);
    if (!text || Number.isNaN(time)) return "—";
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(new Date(time));
  }

  function renderList(containerId, values, emptyText) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.replaceChildren();

    if (!values.length) {
      var empty = document.createElement("p");
      empty.className = "dashboard-empty";
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }

    var list = document.createElement("ul");
    values.forEach(function (text) {
      var item = document.createElement("li");
      item.textContent = text;
      list.appendChild(item);
    });
    container.appendChild(list);
  }

  function appendText(parent, tagName, className, text) {
    if (!parent || !text) return null;
    var node = document.createElement(tagName);
    if (className) node.className = className;
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function buildDashboardCalculatorPayload(data) {
    var dashboard = safeObject(data);
    var financial = safeObject(dashboard.financialProfile);
    var onboarding = safeObject(dashboard.onboarding);
    var onboardingFinancials = safeObject(onboarding.financialInputs);
    var locations = Array.isArray(onboarding.locationPreferences) ? onboarding.locationPreferences : [];
    var propertyTypes = Array.isArray(onboarding.propertyPreferences) ? onboarding.propertyPreferences : [];
    var targetPrice = safeNumber(financial.targetPurchasePrice) || safeNumber(onboarding.budgetMax);
    var downPayment = safeNumber(financial.downPayment) ||
      safeNumber(financial.savings) ||
      safeNumber(onboardingFinancials.availableFunds);
    var availableFunds = safeNumber(financial.savings) ||
      safeNumber(financial.downPayment) ||
      safeNumber(onboardingFinancials.availableFunds);

    return {
      goal: safeText(onboarding.intent, "") || safeText(financial.riskTolerance, ""),
      targetPurchasePrice: targetPrice,
      downPayment: downPayment,
      availableFunds: availableFunds,
      location: safeText(financial.targetLocation, "") || locations[0] || "",
      timeline: safeText(financial.timeline, "") || safeText(onboarding.timeline, ""),
      propertyType: propertyTypes[0] || "",
      employmentType: safeText(financial.employmentStatus, ""),
      employmentStability: safeText(financial.employmentStability, ""),
      income: {
        annualGross: safeNumber(financial.annualIncome)
      },
      debt: {
        monthlyPayments: safeNumber(financial.monthlyDebt)
      },
      assumptions: {
        interestRate: 5.25,
        amortizationYears: 25
      },
      context: {
        source: "dashboard_ai_calculator",
        firstTimeBuyer: financial.firstTimeBuyer === true,
        riskTolerance: safeText(financial.riskTolerance, ""),
        onboardingGoal: safeText(onboarding.intent, ""),
        propertyInterests: propertyTypes,
        onboardingRecommendationSummary: safeText(safeObject(dashboard.aiInsights && dashboard.aiInsights[0]).summary, "")
      }
    };
  }

  function findMissingCalculatorInputs(payload) {
    var missing = [];
    if (!safeNumber(payload.income && payload.income.annualGross)) missing.push("annual income");
    if (!safeNumber(payload.debt && payload.debt.monthlyPayments)) missing.push("monthly debt payments");
    if (!safeNumber(payload.downPayment)) missing.push("down payment or available funds");
    if (!safeNumber(payload.targetPurchasePrice)) missing.push("target purchase price or budget range");
    if (!safeText(payload.location, "")) missing.push("target location");
    return missing;
  }

  function setCalculatorStatus(message, type) {
    var status = document.getElementById("dashboardCalculatorStatus");
    if (!status) return;
    status.textContent = message || "";
    status.classList.remove("is-error", "is-success");
    if (type) status.classList.add(type);
  }

  function setCalculatorLoading(loading) {
    var button = document.getElementById("dashboardCalculatorRun");
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? "Running calculator…" : "Run AI Calculator";
  }

  function normalizeCalculatorResult(response) {
    var source = safeObject(response);
    var reportData = safeObject(source.reportData);
    var range = safeObject(reportData.estimatedBudgetRange);
    var scenarios = Array.isArray(reportData.loanScenarios) ? reportData.loanScenarios : [];
    var payments = scenarios
      .map(function (scenario) { return safeNumber(safeObject(scenario).estimatedMonthlyPayment); })
      .filter(function (value) { return value !== null; });
    var paymentRange = payments.length
      ? formatMoney(Math.min.apply(Math, payments)) + "–" + formatMoney(Math.max.apply(Math, payments)) + "/mo"
      : "Not enough data";
    var affordability = safeText(range.conservative, "") && safeText(range.stretch, "")
      ? safeText(range.conservative, "") + "–" + safeText(range.stretch, "")
      : safeText(range.target, "Not enough data");

    return {
      summary: safeText(source.summary, "Kimure generated a directional calculator estimate."),
      score: safeNumber(source.score),
      riskLevel: safeText(source.riskLevel, "unknown"),
      affordabilityRange: affordability,
      paymentRange: paymentRange,
      downPaymentInsight: "Saved available funds/down payment: " + formatMoney(safeNumber(safeObject(currentDashboard || {}).financialProfile && safeObject(currentDashboard.financialProfile).downPayment) || safeNumber(safeObject(currentDashboard || {}).financialProfile && safeObject(currentDashboard.financialProfile).savings)) + ".",
      rentalInvestmentSignal: "Dashboard estimate uses saved financial and onboarding profile fields. Add rental-income goals in onboarding for an investment-focused signal.",
      keyAssumptions: [
        "Interest-rate assumption: 5.25%.",
        "Amortization assumption: 25 years.",
        "Missing income, debt, down payment, or target-price fields are called out instead of guessed."
      ],
      risks: safeList(reportData.warningFlags)
        .concat(safeList(reportData.missingFields).map(function (field) {
          return "Missing input: " + field;
        })),
      keyInsights: safeList(source.keyInsights),
      recommendations: safeList(source.recommendations),
      nextSteps: safeList(reportData.nextBestActions),
      disclaimer: "Estimate only. Not financial, mortgage, legal, tax, or approval advice."
    };
  }

  function renderCalculatorResult(response) {
    var container = document.getElementById("dashboardCalculatorResult");
    if (!container) return;
    var result = normalizeCalculatorResult(response);
    container.replaceChildren();

    appendText(container, "h3", "", "AI calculator estimate");
    appendText(container, "p", "", result.summary);

    var metrics = document.createElement("div");
    metrics.className = "dashboard-calculator-metrics";
    [
      ["Readiness", result.score === null ? "—" : String(result.score)],
      ["Risk", humanize(result.riskLevel, "Unknown")],
      ["Payment", result.paymentRange],
      ["Affordability", result.affordabilityRange]
    ].forEach(function (item) {
      var metric = document.createElement("div");
      appendText(metric, "span", "", item[0]);
      appendText(metric, "strong", "", item[1]);
      metrics.appendChild(metric);
    });
    container.appendChild(metrics);

    var sections = document.createElement("div");
    sections.className = "dashboard-calculator-sections";
    [
      ["Affordability / buying power estimate", result.affordabilityRange],
      ["Estimated monthly payment range", result.paymentRange],
      ["Down payment / available funds insight", result.downPaymentInsight],
      ["Rental / investment signal", result.rentalInvestmentSignal]
    ].forEach(function (item) {
      var section = document.createElement("section");
      appendText(section, "h4", "", item[0]);
      appendText(section, "p", "", item[1]);
      sections.appendChild(section);
    });
    container.appendChild(sections);

    appendCalculatorList(container, "Key assumptions", result.keyAssumptions);
    appendCalculatorList(container, "Risks / missing information", result.risks);
    appendCalculatorList(container, "Key signals", result.keyInsights);
    appendCalculatorList(container, "Next actions", result.nextSteps);
    appendCalculatorList(container, "Recommendations", result.recommendations);
    appendText(container, "p", "dashboard-muted", result.disclaimer);
    container.hidden = false;
  }

  function appendCalculatorList(container, title, values) {
    if (!values.length) return;
    appendText(container, "h4", "", title);
    var list = document.createElement("ul");
    values.slice(0, 4).forEach(function (value) {
      appendText(list, "li", "", value);
    });
    container.appendChild(list);
  }

  async function runDashboardCalculator() {
    if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.requestMortgage) {
      setCalculatorStatus("The Kimure API client is not available on this page.", "is-error");
      return;
    }

    var payload = buildDashboardCalculatorPayload(currentDashboard || {});
    var missing = findMissingCalculatorInputs(payload);

    setCalculatorLoading(true);
    setCalculatorStatus(
      missing.length
        ? "Running with available account data. Missing: " + missing.join(", ") + "."
        : "Running calculator with your saved account inputs.",
      ""
    );

    var result = await window.KIMURE_AUTH.requestMortgage(payload);
    setCalculatorLoading(false);

    if (!result.ok) {
      setCalculatorStatus(result.message || "Calculator estimate could not be generated right now.", "is-error");
      return;
    }

    renderCalculatorResult(result.data);
    setCalculatorStatus("Calculator estimate complete. Review the directional result below.", "is-success");
  }

  function renderNextActions(data) {
    var actions = safeList(data.nextActions);
    renderList(
      "dashboardNextActions",
      actions.length ? actions : ["Review your credit readiness and mortgage estimate."],
      "Review your credit readiness and mortgage estimate."
    );
  }

  function renderProfile(data) {
    var profile = safeObject(data.profile);
    var userMetadata = currentUser && currentUser.user_metadata && typeof currentUser.user_metadata === "object"
      ? currentUser.user_metadata
      : {};
    var fullName = safeText(profile.fullName, "") || safeText(userMetadata.full_name, "");
    var role = safeText(profile.role, "") || safeText(userMetadata.role, "");
    var city = safeText(profile.city, "");
    var country = safeText(profile.country, "");
    var location = [city, country].filter(Boolean).join(", ");

    setCardTitle("dashboardAccountCard", fullName ? "Account profile" : "Account profile incomplete");
    setText("dashboardProfileName", displayText(fullName));
    setText("dashboardProfileRole", humanize(role, "Not added yet"));
    setText("dashboardProfileLocation", displayText(location));
    setText("dashboardProfileKyc", humanize(profile.kycStatus, "Not added yet"));
  }

  function renderOnboarding(data) {
    var onboarding = safeObject(data.onboarding);
    var hasOnboarding = Object.keys(onboarding).length > 0;
    var locations = Array.isArray(onboarding.locationPreferences)
      ? onboarding.locationPreferences.filter(Boolean)
      : [];
    var propertyPreferences = Array.isArray(onboarding.propertyPreferences)
      ? onboarding.propertyPreferences.filter(Boolean)
      : [];

    setCardTitle("dashboardOnboardingCard", hasOnboarding ? "Smart onboarding profile" : "No onboarding profile yet");
    setText("dashboardOnboardingGoal", humanize(onboarding.intent, "Not added yet"));
    setText("dashboardOnboardingBudget", formatBudgetRange(onboarding.budgetMin, onboarding.budgetMax));
    setText("dashboardOnboardingLocation", locations.length ? locations.join(", ") : "Not added yet");
    setText("dashboardOnboardingProperties", propertyPreferences.length ? propertyPreferences.map(function (item) {
      return humanize(item, item);
    }).join(", ") : "Not added yet");
    setText("dashboardOnboardingTimeline", humanize(onboarding.timeline, "Not added yet"));
    setText("dashboardOnboardingUpdated", formatDate(onboarding.updatedAt) === "—" ? "Not added yet" : formatDate(onboarding.updatedAt));
  }

  function renderCredit(data) {
    var credit = safeObject(data.creditReadiness);
    var hasCredit = Object.keys(credit).length > 0;
    setCardTitle("dashboardCreditCard", hasCredit ? "Credit readiness summary" : "No credit readiness yet");

    setText("dashboardCreditScore", safeNumber(credit.readinessScore) === null ? "—" : String(credit.readinessScore));
    setText("dashboardCreditRisk", humanize(credit.riskLevel, "—"));
    setText("dashboardCreditProvider", humanize(credit.provider, "—"));
    setText("dashboardCreditBureau", humanize(credit.bureau, "—"));
    setText("dashboardCreditVerification", humanize(credit.verificationStatus, "—"));
    setText("dashboardCreditExpiry", formatDate(credit.expiresAt));
  }

  function renderFinancial(data) {
    var profile = safeObject(data.financialProfile);
    var hasProfile = Object.keys(profile).length > 0;
    setCardTitle("dashboardFinancialCard", hasProfile ? "Saved financial profile" : "No saved financial profile yet");

    setText("dashboardAnnualIncome", formatMoney(profile.annualIncome));
    setText("dashboardMonthlyDebt", formatMoney(profile.monthlyDebt));
    setText("dashboardSavings", formatMoney(profile.savings));
    setText("dashboardDownPayment", formatMoney(profile.downPayment));
    setText("dashboardTargetPrice", formatMoney(profile.targetPurchasePrice));
    setText(
      "dashboardEmployment",
      [humanize(profile.employmentStatus, ""), humanize(profile.employmentStability, "")]
        .filter(Boolean)
        .join(" / ") || "—"
    );
    setText("dashboardTimeline", humanize(profile.timeline, "—"));
    setText("dashboardTargetLocation", safeText(profile.targetLocation, "—"));
  }

  function renderMortgage(data) {
    var mortgage = safeObject(data.mortgageReadiness);
    var hasMortgage = Object.keys(mortgage).length > 0;
    setCardTitle("dashboardMortgageCard", hasMortgage ? "Mortgage readiness summary" : "No mortgage estimate yet");

    setText("dashboardMortgageScore", safeNumber(mortgage.score) === null ? "—" : String(mortgage.score));
    setText("dashboardMortgageRisk", humanize(mortgage.riskLevel, "—"));
    setText("dashboardAffordability", safeText(mortgage.affordabilityRange, "—"));
    setText("dashboardPaymentRange", safeText(mortgage.paymentRange, "—"));
    setText("dashboardCreditReference", humanize(mortgage.creditReferenceStatus, "—"));
  }

  function renderConsents(data) {
    var container = document.getElementById("dashboardConsents");
    var consents = Array.isArray(data.consents) ? data.consents.slice(0, 5) : [];
    container.replaceChildren();

    if (!consents.length) {
      var empty = document.createElement("p");
      empty.className = "dashboard-empty";
      empty.textContent = "No bureau consent on file.";
      container.appendChild(empty);
      return;
    }

    consents.forEach(function (item) {
      var consent = safeObject(item);
      var row = document.createElement("div");
      row.className = "dashboard-consent-row";

      var title = document.createElement("strong");
      title.textContent = [humanize(consent.provider, "Provider"), humanize(consent.bureau, "Bureau")]
        .filter(Boolean)
        .join(" / ");

      var meta = document.createElement("span");
      meta.textContent = humanize(consent.status, "Unknown") +
        " · v" + safeText(consent.consentVersion, "—") +
        " · expires " + formatDate(consent.expiresAt);

      row.appendChild(title);
      row.appendChild(meta);
      container.appendChild(row);
    });
  }

  function renderInsights(data) {
    var container = document.getElementById("dashboardAiInsights");
    var insights = Array.isArray(data.aiInsights) ? data.aiInsights.slice(0, 6) : [];
    container.replaceChildren();
    setCardTitle("dashboardInsightsCard", insights.length ? "Recent AI insights" : "No AI insights yet");

    if (!insights.length) {
      var empty = document.createElement("p");
      empty.className = "dashboard-empty";
      empty.textContent = "No AI insights yet.";
      container.appendChild(empty);
      return;
    }

    insights.forEach(function (item) {
      var insight = safeObject(item);
      var card = document.createElement("section");
      card.className = "dashboard-insight-card";

      var title = document.createElement("h3");
      title.textContent = safeText(insight.title, humanize(insight.reportType, "AI insight"));
      card.appendChild(title);

      var summary = document.createElement("p");
      summary.textContent = safeText(insight.summary, "No summary returned.");
      card.appendChild(summary);

      var recommendations = safeList(insight.recommendations);
      if (recommendations.length) {
        var list = document.createElement("ul");
        recommendations.slice(0, 3).forEach(function (text) {
          var li = document.createElement("li");
          li.textContent = text;
          list.appendChild(li);
        });
        card.appendChild(list);
      }

      var nextSteps = safeList(insight.nextSteps);
      if (nextSteps.length) {
        var next = document.createElement("p");
        next.className = "dashboard-next-step";
        next.textContent = "Next: " + nextSteps[0];
        card.appendChild(next);
      }

      container.appendChild(card);
    });
  }

  function renderDashboard(data) {
    var dashboard = safeObject(data);
    currentDashboard = dashboard;
    stateTitle.textContent = "Dashboard ready";
    stateMessage.textContent = "Only sanitized account and AI summary fields are shown here.";

    renderNextActions(dashboard);
    renderProfile(dashboard);
    renderOnboarding(dashboard);
    renderCredit(dashboard);
    renderFinancial(dashboard);
    renderMortgage(dashboard);
    renderConsents(dashboard);
    renderInsights(dashboard);
  }

  function renderError(message) {
    stateTitle.textContent = "Dashboard unavailable";
    stateMessage.textContent = message || "Dashboard data could not be loaded. Please try again.";
  }

  async function loadDashboard() {
    if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.fetchDashboardAiCredit) {
      renderError("Dashboard auth helpers are not available.");
      return;
    }

    if (window.KIMURE_AUTH.getCurrentUser) {
      currentUser = await window.KIMURE_AUTH.getCurrentUser();
      if (!currentUser) {
        renderError("Please sign in to view your dashboard.");
        return;
      }
    }

    var result = await window.KIMURE_AUTH.fetchDashboardAiCredit();
    if (!result.ok) {
      renderError(result.message);
      return;
    }

    var dashboard = safeObject(result.data);
    if (!dashboard.onboarding && window.KIMURE_AUTH.fetchOnboardingProfile) {
      var onboardingProfile = await window.KIMURE_AUTH.fetchOnboardingProfile();
      if (onboardingProfile) {
        dashboard.onboarding = normalizeOnboardingFallback(onboardingProfile);
      }
    }

    renderDashboard(dashboard);
  }

  var calculatorButton = document.getElementById("dashboardCalculatorRun");
  if (calculatorButton) {
    calculatorButton.addEventListener("click", function () {
      runDashboardCalculator();
    });
  }

  loadDashboard();

  function normalizeOnboardingFallback(profile) {
    var source = safeObject(profile);
    var locations = Array.isArray(source.location_preferences)
      ? source.location_preferences.map(function (item) {
        var location = safeObject(item);
        return [safeText(location.city, ""), safeText(location.country, "")]
          .filter(Boolean)
          .join(", ");
      }).filter(Boolean)
      : [];
    var financialInputs = safeObject(source.financial_inputs);

    return {
      intent: safeText(source.intent, ""),
      budgetMin: safeNumber(source.budget_min),
      budgetMax: safeNumber(source.budget_max),
      timeline: safeText(source.timeline, ""),
      riskLevel: safeText(source.risk_level, ""),
      locationPreferences: locations,
      propertyPreferences: Array.isArray(source.property_preferences)
        ? source.property_preferences.filter(function (item) { return typeof item === "string" && item.trim(); })
        : [],
      financialInputs: {
        availableFunds: safeNumber(financialInputs.available_funds),
        monthlyRentalIncome: safeNumber(financialInputs.monthly_rental_income)
      },
      updatedAt: safeText(source.updated_at, "")
    };
  }
})();
