(function () {
  "use strict";

  var form = document.getElementById("mpSearchForm");
  var input = document.getElementById("mpSearchInput");
  var featuredGrid = document.getElementById("mpFeaturedGrid");

  var blocks = [
    { mode: "buy", grid: document.getElementById("mpGridBuy"), emptyEl: document.getElementById("mpEmptyBuy") },
    { mode: "sale", grid: document.getElementById("mpGridSale"), emptyEl: document.getElementById("mpEmptySale") },
    { mode: "rent", grid: document.getElementById("mpGridRent"), emptyEl: document.getElementById("mpEmptyRent") },
    { mode: "invest", grid: document.getElementById("mpGridInvest"), emptyEl: document.getElementById("mpEmptyInvest") },
  ];

  if (!featuredGrid || blocks.some(function (b) { return !b.grid || !b.emptyEl; })) return;

  featuredGrid.querySelectorAll(".mp-listing-card").forEach(function (card) {
    var modesStr = (card.getAttribute("data-modes") || "").toLowerCase();
    var modes = modesStr.split(/\s+/).filter(Boolean);

    modes.forEach(function (m) {
      blocks.forEach(function (block) {
        if (block.mode !== m) return;
        var copy = card.cloneNode(true);
        copy.removeAttribute("id");
        block.grid.insertBefore(copy, block.emptyEl);
      });
    });
  });

  function filterListings(query) {
    var q = (query || "").trim().toLowerCase();

    blocks.forEach(function (block) {
      var visible = 0;
      block.grid.querySelectorAll(".mp-listing-card").forEach(function (card) {
        var search = (card.getAttribute("data-search") || "").toLowerCase();
        var show = !q || search.indexOf(q) >= 0;
        card.classList.toggle("mp-hidden", !show);
        if (show) visible++;
      });
      block.emptyEl.classList.toggle("mp-hidden", visible > 0);
    });
  }

  if (form && input) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = input.value.trim();
      var url = window.location.pathname;
      if (q) url += "?q=" + encodeURIComponent(q);
      window.history.replaceState({}, "", url);
      filterListings(q);
    });

    input.addEventListener("input", function () {
      filterListings(input.value);
    });
  }

  function setQueryFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var q = params.get("q");
    if (q && input) {
      input.value = q;
      filterListings(q);
    } else {
      filterListings("");
    }
  }

  setQueryFromUrl();

  var aiForms = document.querySelectorAll(".mp-ai-form[data-ai-tool]");

  function formValue(aiForm, name) {
    var field = aiForm.elements[name];
    return field && typeof field.value === "string" ? field.value.trim() : "";
  }

  function parseMarketplaceNumber(value) {
    var trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed) return null;
    if (!/^\$?\s*(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(trimmed)) {
      return null;
    }

    var number = Number(trimmed.replace(/[$,\s]/g, ""));
    return Number.isFinite(number) ? number : null;
  }

  function formNumber(aiForm, name) {
    var field = aiForm.elements[name];
    return parseMarketplaceNumber(field && typeof field.value === "string" ? field.value : "");
  }

  function validateNumericField(aiForm, name, emptyMessage, invalidMessage) {
    var field = aiForm.elements[name];
    if (!field) return true;

    field.setCustomValidity("");
    var rawValue = typeof field.value === "string" ? field.value.trim() : "";
    if (!rawValue) {
      field.setCustomValidity(emptyMessage);
    } else {
      var parsedValue = parseMarketplaceNumber(rawValue);
      if (parsedValue === null || parsedValue <= 0) {
        field.setCustomValidity(invalidMessage);
      }
    }

    if (!field.checkValidity()) {
      field.reportValidity();
      field.focus();
      return false;
    }
    return true;
  }

  function validateAiForm(aiForm, tool) {
    var numericFieldIsValid = true;

    if (tool === "scout") {
      numericFieldIsValid = validateNumericField(
        aiForm,
        "budget",
        "Enter a purchase budget.",
        "Enter a valid purchase budget."
      );
    } else if (tool === "analyze" || tool === "valuate") {
      numericFieldIsValid = validateNumericField(
        aiForm,
        "price",
        "Enter an asking price.",
        "Enter a valid asking price."
      );
    } else if (tool === "rental") {
      numericFieldIsValid = validateNumericField(
        aiForm,
        "budget",
        "Enter a monthly budget.",
        "Enter a valid monthly budget."
      );
    }

    return numericFieldIsValid && aiForm.reportValidity();
  }

  function compact(object) {
    return Object.keys(object).reduce(function (result, key) {
      var value = object[key];
      if (value !== null && value !== undefined && value !== "") result[key] = value;
      return result;
    }, {});
  }

  function buildAiPayload(aiForm, tool) {
    var metadata = {
      source: "marketplace_ai_tools",
      schemaVersion: "web-marketplace-v1"
    };

    if (tool === "scout") {
      var scoutGoal = formValue(aiForm, "goal");
      var scoutLocation = formValue(aiForm, "location");
      var scoutType = formValue(aiForm, "propertyType");
      var scoutBudget = formNumber(aiForm, "budget");
      return {
        question: "Recommend a focused property search direction using my marketplace preferences.",
        onboarding: {
          intent: scoutGoal,
          budgetMax: scoutBudget,
          locationPreferences: [{ location: scoutLocation }],
          propertyPreferences: [scoutType]
        },
        financials: {},
        goals: [scoutGoal],
        filters: {
          transactionType: scoutGoal,
          location: scoutLocation,
          maxPrice: scoutBudget,
          propertyTypes: [scoutType]
        },
        property: { types: [scoutType] },
        context: {},
        metadata: metadata,
        consent: false
      };
    }

    if (tool === "analyze") {
      var analysisPrice = formNumber(aiForm, "price");
      var analysisAddress = formValue(aiForm, "address");
      var analysisType = formValue(aiForm, "propertyType");
      var analysisDetails = formValue(aiForm, "details");
      return {
        question: "Analyze this property for value drivers, investment fit, risks, and ROI-style considerations.",
        onboarding: {},
        financials: { askingPrice: analysisPrice },
        goals: ["property-analysis", "investment-fit"],
        filters: {},
        property: {
          address: analysisAddress,
          askingPrice: analysisPrice,
          propertyType: analysisType,
          details: analysisDetails
        },
        context: { userProvidedDetails: analysisDetails },
        metadata: metadata,
        consent: false
      };
    }

    if (tool === "rental") {
      var rentalLocation = formValue(aiForm, "location");
      var rentalBudget = formNumber(aiForm, "budget");
      var rentalNeeds = formValue(aiForm, "needs");
      return {
        question: "Create rental matching criteria from my budget, location, lifestyle, and household needs.",
        onboarding: { intent: "renting" },
        financials: { monthlyRentBudget: rentalBudget },
        goals: ["rental-match"],
        filters: {
          location: rentalLocation,
          monthlyRentMax: rentalBudget
        },
        property: { rentalNeeds: rentalNeeds },
        context: { lifestyleAndHouseholdNeeds: rentalNeeds },
        metadata: metadata,
        consent: false
      };
    }

    if (tool === "valuate") {
      var valuePrice = formNumber(aiForm, "price");
      var valueAddress = formValue(aiForm, "address");
      var valueType = formValue(aiForm, "propertyType");
      var valueDetails = formValue(aiForm, "details");
      return {
        question: "Provide directional fair-value reasoning and explain what evidence is needed for a stronger estimate.",
        onboarding: {},
        financials: { askingPrice: valuePrice },
        goals: ["property-valuation"],
        filters: {},
        property: {
          address: valueAddress,
          askingPrice: valuePrice,
          propertyType: valueType,
          details: valueDetails
        },
        context: { userProvidedDetails: valueDetails },
        metadata: metadata,
        consent: false
      };
    }

    return {
      question: formValue(aiForm, "question"),
      onboarding: {},
      financials: {},
      goals: [],
      filters: {},
      property: {},
      context: { marketplaceQuestion: true },
      metadata: metadata,
      consent: false
    };
  }

  function safeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function safeText(value, fallback) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  function safeList(value) {
    return Array.isArray(value)
      ? value.filter(function (item) {
        return typeof item === "string" && item.trim();
      }).slice(0, 12)
      : [];
  }

  function normalizeAiResult(response, selectedTool) {
    var source = safeObject(response);
    var reportData = safeObject(source.reportData);
    var crmSignals = safeObject(source.crmSignals);
    var nextSteps = safeList(source.nextSteps);
    if (!nextSteps.length) nextSteps = safeList(reportData.nextBestActions);
    var followUp = safeText(crmSignals.suggestedFollowUp, null);
    if (followUp && nextSteps.indexOf(followUp) === -1) nextSteps.push(followUp);

    return {
      tool: safeText(source.tool, selectedTool),
      source: safeText(source.source, safeText(reportData.source, "fallback")),
      summary: safeText(source.summary, "No recommendation summary was returned."),
      score: typeof source.score === "number" && Number.isFinite(source.score)
        ? source.score
        : null,
      riskLevel: safeText(source.riskLevel, null),
      keyInsights: safeList(source.keyInsights),
      recommendations: safeList(source.recommendations),
      nextSteps: nextSteps.slice(0, 12),
      disclaimer: safeText(
        source.disclaimer,
        "This recommendation is informational and is not professional advice."
      )
    };
  }

  function getToolLabel(tool) {
    var labels = {
      scout: "Property Scout Recommendation",
      analyze: "Property Analysis",
      rental: "Rental Match Recommendation",
      valuate: "Property Value Evaluation",
      mortgage: "Mortgage Readiness",
      "investment-planner": "Investment Plan Recommendation",
      chat: "Ask Kimure Guidance"
    };
    return labels[tool] || "Kimure AI Recommendation";
  }

  function appendTextElement(parent, tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    parent.appendChild(element);
    return element;
  }

  function appendResultList(parent, title, items, emptyMessage) {
    var section = document.createElement("section");
    section.className = "mp-ai-result-section";
    appendTextElement(section, "h5", "", title);
    var list = document.createElement("ul");
    var values = items.length ? items : [emptyMessage];
    values.forEach(function (text) {
      appendTextElement(list, "li", "", text);
    });
    section.appendChild(list);
    parent.appendChild(section);
  }

  function renderAiResult(container, response, selectedTool) {
    var result = normalizeAiResult(response, selectedTool);
    container.replaceChildren();

    if (result.source === "gemini") {
      appendTextElement(
        container,
        "p",
        "mp-ai-source-badge",
        "Gemini-backed recommendation"
      );
    } else {
      appendTextElement(
        container,
        "p",
        "mp-ai-source-notice",
        "AI recommendation generated from available platform signals."
      );
    }

    appendTextElement(container, "p", "mp-ai-result-label", getToolLabel(result.tool));
    appendTextElement(container, "h4", "", result.summary);

    if (result.score !== null || result.riskLevel) {
      var metrics = document.createElement("div");
      metrics.className = "mp-ai-result-metrics";
      if (result.score !== null) appendTextElement(metrics, "span", "", "Score: " + result.score);
      if (result.riskLevel && result.riskLevel !== "unknown") {
        appendTextElement(metrics, "span", "", "Risk: " + result.riskLevel);
      }
      container.appendChild(metrics);
    }

    appendResultList(container, "Key insights", result.keyInsights, "No additional insights were returned.");
    appendResultList(container, "Recommendations", result.recommendations, "No additional recommendations were returned.");
    appendResultList(container, "Next steps", result.nextSteps, "Add more property details for more specific guidance.");
    appendTextElement(container, "p", "mp-ai-result-disclaimer", result.disclaimer);
    container.hidden = false;
    container.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function setAiFormLoading(aiForm, loading) {
    var button = aiForm.querySelector('button[type="submit"]');
    if (!button) return;
    if (loading) {
      button.dataset.originalText = button.textContent;
      button.textContent = "Generating…";
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
    }
    button.disabled = loading;
    aiForm.setAttribute("aria-busy", loading ? "true" : "false");
  }

  aiForms.forEach(function (aiForm) {
    aiForm.querySelectorAll('input[inputmode="decimal"]').forEach(function (field) {
      field.addEventListener("input", function () {
        field.setCustomValidity("");
      });
    });

    aiForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      var tool = aiForm.getAttribute("data-ai-tool");
      if (!validateAiForm(aiForm, tool)) return;

      var status = aiForm.querySelector(".mp-ai-form-status");
      var resultContainer = aiForm.parentElement.querySelector(".mp-ai-result");

      if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.requestAiRecommendation) {
        status.textContent = "AI recommendations could not be generated right now. Please try again.";
        status.classList.add("is-error");
        return;
      }

      setAiFormLoading(aiForm, true);
      status.textContent = "Generating recommendation…";
      status.classList.remove("is-error");
      resultContainer.hidden = true;

      var response = await window.KIMURE_AUTH.requestAiRecommendation(
        tool,
        compact(buildAiPayload(aiForm, tool))
      );
      setAiFormLoading(aiForm, false);

      if (!response || !response.ok) {
        status.textContent = "AI recommendations could not be generated right now. Please try again.";
        status.classList.add("is-error");
        return;
      }

      status.textContent = "Recommendation ready.";
      renderAiResult(resultContainer, response.data, tool);
    });
  });
})();
