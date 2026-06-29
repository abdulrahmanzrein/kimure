(function () {
  "use strict";

  var stateTitle = document.getElementById("dashboardStateTitle");
  if (!stateTitle) return;

  var stateMessage = document.getElementById("dashboardStateMessage");

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

  function renderNextActions(data) {
    var actions = safeList(data.nextActions);
    renderList(
      "dashboardNextActions",
      actions.length ? actions : ["Review your credit readiness and mortgage estimate."],
      "Review your credit readiness and mortgage estimate."
    );
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
    stateTitle.textContent = "Dashboard ready";
    stateMessage.textContent = "Only sanitized account and AI summary fields are shown here.";

    renderNextActions(dashboard);
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
      await window.KIMURE_AUTH.getCurrentUser();
    }

    var result = await window.KIMURE_AUTH.fetchDashboardAiCredit();
    if (!result.ok) {
      renderError(result.message);
      return;
    }

    renderDashboard(result.data);
  }

  loadDashboard();
})();
