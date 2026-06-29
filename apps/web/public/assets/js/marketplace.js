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

  function getApiBaseUrl() {
    var cfg = window.KIMURE_SUPABASE_CONFIG;
    if (cfg && cfg.apiBaseUrl) return cfg.apiBaseUrl;
    return "http://localhost:3001/api";
  }

  function setProviderStatus(statusEl, state, message) {
    if (!statusEl) return;
    statusEl.className = "mp-provider-status";
    if (state) statusEl.classList.add("is-" + state);
    statusEl.textContent = message || "";
  }

  function clearNode(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function appendNode(parent, tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    parent.appendChild(el);
    return el;
  }

  function formatMoney(value, listing) {
    var amount = Number(value);
    if (!Number.isFinite(amount)) return "Price unavailable";
    var formatted = new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0
    }).format(amount);
    var signals = Array.isArray(listing.matchSignals) ? listing.matchSignals.join(" ").toLowerCase() : "";
    return signals.indexOf("rental") >= 0 && amount < 10000 ? formatted + " /mo" : formatted;
  }

  function formatProviderLabel(value) {
    return String(value || "mock_provider").replace(/_/g, " ");
  }

  function formatBlockedReason(value) {
    return formatProviderLabel(value || "unavailable").replace(/\b\w/g, function (letter) {
      return letter.toUpperCase();
    });
  }

  function buildProviderListingsQuery(formToRead) {
    var params = new URLSearchParams();
    var provider = textValue(formToRead, "provider");
    var location = textValue(formToRead, "location");
    var type = textValue(formToRead, "type");
    var maxPrice = parseMoney(textValue(formToRead, "maxPrice"));
    var intent = textValue(formToRead, "intent");

    if (provider === "crea_ddf") params.set("provider", provider);
    if (location) params.set("location", location);
    if (type) params.set("type", type);
    if (maxPrice !== null) params.set("maxPrice", String(maxPrice));
    if (intent) params.set("intent", intent);

    return params;
  }

  async function requestProviderListings(params) {
    var baseUrl = getApiBaseUrl().replace(/\/$/, "");
    var query = params && params.toString() ? "?" + params.toString() : "";
    var response = await fetch(baseUrl + "/listings/search" + query);
    var body = await response.json().catch(function () { return {}; });

    if (!response.ok) {
      throw new Error("listings_unavailable");
    }

    return body;
  }

  function isPendingAccessResponse(response) {
    return response &&
      response.providerStatus === "pending_access" &&
      response.source === "crea_ddf_pending_access";
  }

  function renderProviderListingCard(grid, listing) {
    var card = appendNode(grid, "article", "mp-provider-card");
    var top = appendNode(card, "div", "mp-provider-card-top");
    var titleWrap = appendNode(top, "div");
    var badges = appendNode(top, "div", "mp-provider-badges");

    appendNode(titleWrap, "h3", null, listing.title || "Sample listing");
    appendNode(titleWrap, "p", "mp-provider-price", formatMoney(listing.price, listing));

    appendNode(badges, "span", "mp-provider-badge", formatProviderLabel(listing.sourceProvider || "mock_provider"));
    appendNode(
      badges,
      "span",
      "mp-provider-badge mp-provider-badge--mock",
      "Mock data"
    );

    appendNode(card, "p", "mp-provider-location", listing.location || "Location unavailable");
    appendNode(card, "p", "mp-provider-address", listing.addressSummary || "Address summary unavailable");

    var meta = [];
    if (listing.type) meta.push(String(listing.type));
    if (Number(listing.bedrooms) > 0) meta.push(String(listing.bedrooms) + " bed");
    if (Number(listing.bathrooms) > 0) meta.push(String(listing.bathrooms) + " bath");
    if (listing.propertySize) meta.push(String(listing.propertySize));
    appendNode(card, "p", "mp-provider-meta", meta.join(" • "));

    var signals = Array.isArray(listing.matchSignals) ? listing.matchSignals : [];
    if (signals.length) {
      var signalWrap = appendNode(card, "div", "mp-provider-signals");
      signals.slice(0, 4).forEach(function (signal) {
        appendNode(signalWrap, "span", "mp-provider-signal", signal);
      });
    }
  }

  function renderProviderListings(response) {
    var grid = document.getElementById("mpProviderListingsGrid");
    var emptyEl = document.getElementById("mpProviderListingsEmpty");
    var statusEl = document.getElementById("mpProviderListingsStatus");
    var results = Array.isArray(response.results) ? response.results : [];

    clearNode(grid);

    if (isPendingAccessResponse(response)) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = "CREA DDF access is prepared but pending approval/configuration. No live CREA/DDF listing data is being displayed yet.";
      }
      setProviderStatus(
        statusEl,
        "pending",
        "Provider status: Pending access. " +
          formatBlockedReason(response.blockedReason || "crea_ddf_access_not_configured") +
          ". " +
          (response.disclaimer || "CREA DDF access and compliance must be configured before live listings are used.")
      );
      return;
    }

    if (emptyEl) emptyEl.hidden = results.length > 0;
    setProviderStatus(statusEl, "ready", response.disclaimer || "Sample listings are shown from Kimure's provider-ready listings contract.");

    results.forEach(function (listing) {
      renderProviderListingCard(grid, listing && typeof listing === "object" ? listing : {});
    });
  }

  function initProviderListingsPreview() {
    var listingsForm = document.getElementById("mpProviderListingsForm");
    var grid = document.getElementById("mpProviderListingsGrid");
    var emptyEl = document.getElementById("mpProviderListingsEmpty");
    var statusEl = document.getElementById("mpProviderListingsStatus");

    if (!listingsForm || !grid || !emptyEl || !statusEl) return;

    async function runSearch() {
      var submit = listingsForm.querySelector("button[type='submit']");
      var originalText = submit ? submit.textContent : "";

      if (submit) {
        submit.disabled = true;
        submit.textContent = "Searching...";
      }
      emptyEl.hidden = true;
      emptyEl.textContent = "No sample listings match those filters yet.";
      clearNode(grid);
      setProviderStatus(statusEl, "loading", "Loading sample listings...");

      try {
        var response = await requestProviderListings(buildProviderListingsQuery(listingsForm));
        renderProviderListings(response);
      } catch (err) {
        setProviderStatus(statusEl, "error", "Listing preview could not be reached right now. Please try again.");
        clearNode(grid);
        emptyEl.hidden = true;
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.textContent = originalText;
        }
      }
    }

    listingsForm.addEventListener("submit", function (event) {
      event.preventDefault();
      runSearch();
    });

    runSearch();
  }

  async function getAccessToken() {
    if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.getSupabaseClient) return null;
    var client = window.KIMURE_AUTH.getSupabaseClient();
    if (!client) return null;
    var result = await client.auth.getSession();
    var session = result.data ? result.data.session : null;
    return session ? session.access_token : null;
  }

  function textValue(formToRead, name) {
    var field = formToRead.elements[name];
    return field && field.value ? field.value.trim() : "";
  }

  function parseMoney(value) {
    var normalized = String(value || "").replace(/[$,\s]/g, "");
    if (!normalized) return null;
    var parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function splitList(value) {
    return String(value || "")
      .split(",")
      .map(function (item) { return item.trim(); })
      .filter(Boolean);
  }

  function buildAiPayload(tool, formToRead) {
    var location = textValue(formToRead, "location");
    var address = textValue(formToRead, "address");
    var goals = splitList(textValue(formToRead, "goals"));
    var price = parseMoney(textValue(formToRead, "price"));
    var budget = parseMoney(textValue(formToRead, "budget"));
    var monthlyBudget = parseMoney(textValue(formToRead, "monthlyBudget"));
    var availableFunds = parseMoney(textValue(formToRead, "availableFunds"));
    var timeline = textValue(formToRead, "timeline");
    var details = textValue(formToRead, "details");
    var needs = textValue(formToRead, "needs");
    var question = textValue(formToRead, "question");

    if (tool === "scout") {
      return {
        question: "Find matching properties for this marketplace search.",
        filters: {
          location: location,
          maxPrice: budget || undefined,
          preferences: goals
        },
        goals: goals,
        metadata: { source: "marketplace_ai_tools" }
      };
    }

    if (tool === "analyze") {
      return {
        question: "Analyze this property for fit, risk, and investment reasoning.",
        listing: {
          address: address,
          price: price,
          details: details
        },
        goals: goals,
        metadata: { source: "marketplace_ai_tools" }
      };
    }

    if (tool === "rental") {
      return {
        question: "Find rental fit based on this user profile.",
        filters: {
          location: location,
          monthlyBudget: monthlyBudget,
          needs: needs
        },
        goals: splitList(needs),
        metadata: { source: "marketplace_ai_tools" }
      };
    }

    if (tool === "valuate") {
      return {
        question: "Estimate a directional property value range.",
        property: {
          address: address,
          details: details,
          price: price
        },
        metadata: { source: "marketplace_ai_tools" }
      };
    }

    if (tool === "investment-planner") {
      return {
        question: "Create a property investment planning snapshot.",
        goals: goals,
        financials: {
          availableFunds: availableFunds
        },
        context: {
          timeline: timeline
        },
        metadata: { source: "marketplace_ai_tools" }
      };
    }

    return {
      question: question,
      message: question,
      metadata: { source: "marketplace_ai_tools" }
    };
  }

  var aiToolHelp = {
    scout: {
      title: "Property Scout",
      text: "Turns your budget, location, and property goals into a practical matching brief.",
      preview: ["Suggested property fit", "Important tradeoffs", "Next steps before live listing search"]
    },
    analyze: {
      title: "Property Analyzer",
      text: "Reviews a specific property or address for fit, risks, and investment-style reasoning.",
      preview: ["Fit and risk summary", "Deal-quality considerations", "Questions to verify before acting"]
    },
    rental: {
      title: "Rental Finder",
      text: "Helps organize rental needs around location, lifestyle, monthly budget, and timing.",
      preview: ["Rental fit snapshot", "Lifestyle and budget tradeoffs", "Search priorities"]
    },
    valuate: {
      title: "Property Evaluator",
      text: "Creates a directional value discussion from the property details you enter.",
      preview: ["Directional value context", "Key value drivers", "Cautions before formal appraisal"]
    },
    "investment-planner": {
      title: "Investment Planner",
      text: "Builds a planning snapshot around capital, timeline, goals, and risk tolerance.",
      preview: ["Strategy direction", "Capital and timing considerations", "Practical next steps"]
    },
    chat: {
      title: "Ask Kimure",
      text: "Answers general property, finance, and marketplace questions in the Kimure context.",
      preview: ["Clear answer summary", "Relevant considerations", "Suggested follow-up questions"]
    }
  };

  function updateAiHelpPanel(tool) {
    var help = aiToolHelp[tool] || aiToolHelp.scout;
    var titleEl = document.getElementById("mpAiHelpTitle");
    var textEl = document.getElementById("mpAiHelpText");
    var previewEl = document.getElementById("mpAiOutputPreview");

    if (titleEl) titleEl.textContent = help.title;
    if (textEl) textEl.textContent = help.text;
    if (previewEl) {
      previewEl.innerHTML = "";
      help.preview.forEach(function (item) {
        var li = document.createElement("li");
        li.textContent = item;
        previewEl.appendChild(li);
      });
    }
  }

  function activateAiToolTab(tool) {
    document.querySelectorAll("[data-ai-tab]").forEach(function (tab) {
      var isActive = tab.getAttribute("data-ai-tab") === tool;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    document.querySelectorAll("[data-ai-panel]").forEach(function (panel) {
      var isActive = panel.getAttribute("data-ai-panel") === tool;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });

    updateAiHelpPanel(tool);
  }

  function initAiWorkspaceTabs() {
    var tabs = document.querySelectorAll("[data-ai-tab]");
    if (!tabs.length) return;

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        activateAiToolTab(tab.getAttribute("data-ai-tab"));
      });
    });

    var activeTab = document.querySelector("[data-ai-tab].is-active") || tabs[0];
    activateAiToolTab(activeTab.getAttribute("data-ai-tab"));
  }

  function safeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function safeList(value) {
    return Array.isArray(value)
      ? value.filter(function (item) { return typeof item === "string" && item.trim(); })
      : [];
  }

  function setResultState(resultEl, state, message) {
    if (!resultEl) return;
    resultEl.className = "mp-ai-result";
    if (state) resultEl.classList.add("is-" + state);
    resultEl.textContent = message || "";
  }

  function appendText(parent, tag, className, text) {
    if (!text) return null;
    var el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text;
    parent.appendChild(el);
    return el;
  }

  function appendList(parent, title, items) {
    if (!items.length) return;
    appendText(parent, "h5", "mp-ai-result-subtitle", title);
    var list = document.createElement("ul");
    list.className = "mp-ai-result-list";
    items.forEach(function (item) {
      var li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
    parent.appendChild(list);
  }

  function shouldShowFallbackNotice(response) {
    var reportData = safeObject(response.reportData);
    if (response.source === "fallback") return true;
    if (reportData.source === "fallback") return true;
    if (typeof reportData.geminiMode === "string" && reportData.geminiMode !== "live") return true;
    return false;
  }

  function renderAiResult(resultEl, label, response) {
    var reportData = safeObject(response.reportData);
    var nextSteps = safeList(response.nextSteps).concat(safeList(reportData.nextSteps), safeList(reportData.nextBestActions));
    resultEl.className = "mp-ai-result is-ready";
    resultEl.innerHTML = "";

    appendText(resultEl, "div", "mp-ai-result-kicker", label);
    if (shouldShowFallbackNotice(response)) {
      appendText(resultEl, "p", "mp-ai-fallback-note", "AI recommendation generated from available platform signals.");
    }
    appendText(resultEl, "h4", "mp-ai-result-title", response.summary || "Kimure returned an AI result.");

    var meta = [];
    if (typeof response.score === "number" && Number.isFinite(response.score)) meta.push("Score " + response.score);
    if (response.riskLevel) meta.push("Risk " + response.riskLevel);
    if (meta.length) appendText(resultEl, "p", "mp-ai-result-meta", meta.join(" • "));

    appendList(resultEl, "Key insights", safeList(response.keyInsights));
    appendList(resultEl, "Recommendations", safeList(response.recommendations));
    appendList(resultEl, "Next steps", nextSteps);
    appendText(resultEl, "p", "mp-ai-disclaimer", response.disclaimer || "This result is informational and is not legal, financial, mortgage, appraisal, or investment advice.");
  }

  async function requestMarketplaceAi(tool, payload) {
    var token = await getAccessToken();
    if (!token) {
      return { ok: false, message: "Please sign in before using Marketplace AI Tools." };
    }

    var response;
    try {
      response = await fetch(getApiBaseUrl() + "/ai/" + encodeURIComponent(tool), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      return { ok: false, message: "AI tools could not be reached right now. Please try again." };
    }

    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      return { ok: false, message: "AI recommendations could not be generated right now. Please try again." };
    }

    return { ok: true, data: body };
  }

  function initAiTools() {
    document.querySelectorAll(".mp-ai-form").forEach(function (toolForm) {
      toolForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        var tool = toolForm.getAttribute("data-ai-tool");
        var label = toolForm.getAttribute("data-ai-label") || "Marketplace AI";
        var resultEl = toolForm.parentElement ? toolForm.parentElement.querySelector(".mp-ai-result") : null;
        var submit = toolForm.querySelector("button[type='submit']");
        var originalText = submit ? submit.textContent : "";

        if (!tool) return;
        if (submit) {
          submit.disabled = true;
          submit.textContent = "Generating...";
        }
        setResultState(resultEl, "loading", "Generating AI insight...");

        var aiResponse = await requestMarketplaceAi(tool, buildAiPayload(tool, toolForm));

        if (submit) {
          submit.disabled = false;
          submit.textContent = originalText;
        }

        if (!aiResponse.ok) {
          setResultState(resultEl, "error", aiResponse.message);
          return;
        }

        renderAiResult(resultEl, label, aiResponse.data);
      });
    });
  }

  setQueryFromUrl();
  initProviderListingsPreview();
  initAiWorkspaceTabs();
  initAiTools();
})();
