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
    if (value === "mock_provider") return "Provider-ready context";
    return String(value || "provider_ready").replace(/_/g, " ");
  }

  function formatBlockedReason(value) {
    return formatProviderLabel(value || "unavailable").replace(/\b\w/g, function (letter) {
      return letter.toUpperCase();
    });
  }

  function formatAiProviderContextLabel(value) {
    if (value === "repliers_preview") return "Repliers preview";
    if (value === "mock_provider") return "Provider-ready context";
    return formatBlockedReason(value || "selected provider");
  }

  function truncateText(value, maxLength) {
    var text = String(value || "").trim();
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1).trim() + "…";
  }

  function buildProviderListingsQuery(formToRead) {
    var params = new URLSearchParams();
    var provider = textValue(formToRead, "provider") || "repliers_preview";
    var location = textValue(formToRead, "location");
    var type = textValue(formToRead, "type");
    var maxPrice = parseMoney(textValue(formToRead, "maxPrice"));
    var intent = textValue(formToRead, "intent");

    params.set("provider", provider === "repliers_preview" ? "repliers_preview" : "repliers_preview");
    if (location) params.set("location", location);
    if (type) params.set("type", type);
    if (maxPrice !== null) params.set("maxPrice", String(maxPrice));
    if (intent) params.set("intent", intent);

    return params;
  }

  function getProviderListingsFilterState() {
    var listingsForm = document.getElementById("mpProviderListingsForm");
    if (!listingsForm) return { provider: "repliers_preview" };
    var maxPrice = parseMoney(textValue(listingsForm, "maxPrice"));
    return {
      provider: "repliers_preview",
      location: textValue(listingsForm, "location"),
      type: textValue(listingsForm, "type"),
      maxPrice: maxPrice === null ? undefined : maxPrice,
      intent: textValue(listingsForm, "intent")
    };
  }

  function renderProviderFilterSummary(filters, resultCount) {
    var summaryEl = document.getElementById("mpProviderFilterSummary");
    if (!summaryEl) return;

    var parts = [];
    if (filters.location) parts.push("location: " + filters.location);
    if (filters.type) parts.push("property type: " + filters.type);
    if (typeof filters.maxPrice === "number") parts.push("max price: " + formatMoney(filters.maxPrice, {}));
    if (filters.intent) parts.push("intent: " + filters.intent);

    if (!parts.length) {
      summaryEl.textContent = resultCount > 0
        ? "Showing provider listings from Repliers preview access."
        : "";
      return;
    }

    summaryEl.textContent = "Showing provider listings matching " + parts.join(", ") + ".";
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

  function isRepliersPreviewResponse(response) {
    return response &&
      response.source === "repliers_preview" &&
      String(response.providerStatus || "").indexOf("preview_") === 0;
  }

  function getListingDisplayMode(listingOrResponse) {
    var status = String((listingOrResponse && listingOrResponse.providerStatus) || "");
    if (status === "production_ready" || status === "live_ready") return "production";
    if (status === "active_internal") return "internal";
    if (status.indexOf("preview_") === 0) return "preview";
    if (status === "mock_only") return "sample";
    return "sample";
  }

  function getListingBadgeLabels(listing) {
    var mode = getListingDisplayMode(listing);
    var isLiveProviderData = listing && listing.isLiveProviderData === true;
    var sourceProvider = listing && listing.sourceProvider ? listing.sourceProvider : "provider_ready";

    if (mode === "production") {
      return {
        primary: "PROVIDER LISTING",
        secondary: isLiveProviderData ? "VERIFIED SOURCE" : "PROVIDER DATA"
      };
    }

    if (mode === "internal") {
      return {
        primary: "INTERNAL LISTING",
        secondary: "TEAM-CONTROLLED"
      };
    }

    if (mode === "preview" && sourceProvider === "repliers_preview") {
      return {
        primary: "REPLIERS PREVIEW",
        secondary: "SAMPLE DATA"
      };
    }

    return {
      primary: "PROVIDER READY",
      secondary: "CONTEXT READY"
    };
  }

  function renderProviderListingCard(grid, listing) {
    var card = appendNode(grid, "article", "mp-provider-card");
    var badges = getListingBadgeLabels(listing);
    var imageUrl = typeof listing.imageUrl === "string" && listing.imageUrl ? listing.imageUrl : "";
    var imageWrap = appendNode(card, "div", "mp-provider-image");
    var imageBadges = appendNode(imageWrap, "div", "mp-provider-image-badges");

    appendNode(
      imageBadges,
      "span",
      "mp-provider-badge",
      badges.primary
    );
    appendNode(
      imageBadges,
      "span",
      "mp-provider-badge mp-provider-badge--mock",
      badges.secondary
    );

    if (imageUrl) {
      var image = appendNode(imageWrap, "img", "mp-provider-photo");
      image.src = imageUrl;
      image.alt = listing.imageAlt || listing.title || "Property preview image";
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", function () {
        image.remove();
        imageWrap.classList.add("has-placeholder");
        appendNode(imageWrap, "span", "mp-provider-image-placeholder", "Preview image");
      }, { once: true });
    } else {
      imageWrap.classList.add("has-placeholder");
      appendNode(imageWrap, "span", "mp-provider-image-placeholder", "Preview image");
    }

    if (Number(listing.imageCount) > 1) {
      appendNode(imageWrap, "span", "mp-provider-photo-count", String(listing.imageCount) + " photos");
    }

    var body = appendNode(card, "div", "mp-provider-card-body");
    var top = appendNode(body, "div", "mp-provider-card-top");
    var titleWrap = appendNode(top, "div");

    appendNode(titleWrap, "p", "mp-provider-price", listing.priceLabel || formatMoney(listing.price, listing));
    appendNode(titleWrap, "h3", null, listing.title || "Provider listing");

    appendNode(body, "p", "mp-provider-location", listing.location || "Location unavailable");
    appendNode(body, "p", "mp-provider-address", listing.neighbourhood || listing.addressSummary || "Address summary unavailable");

    var meta = [];
    if (Number(listing.bedrooms) > 0) meta.push(String(listing.bedrooms) + " bed");
    if (Number(listing.bathrooms) > 0) meta.push(String(listing.bathrooms) + " bath");
    if (listing.propertySize) meta.push(String(listing.propertySize));
    if (!meta.length && listing.type) meta.push(String(listing.type));
    appendNode(body, "p", "mp-provider-meta", meta.join(" • ") || "Property details unavailable");

    if (listing.description) {
      appendNode(body, "p", "mp-provider-description", truncateText(listing.description, 150));
    }

    var signals = Array.isArray(listing.tags) && listing.tags.length
      ? listing.tags
      : Array.isArray(listing.matchSignals) ? listing.matchSignals : [];
    if (signals.length) {
      var signalWrap = appendNode(body, "div", "mp-provider-signals");
      signals.slice(0, 4).forEach(function (signal) {
        appendNode(signalWrap, "span", "mp-provider-signal", signal);
      });
    }

    appendNode(body, "button", "mp-provider-preview-cta", "View listing").setAttribute("type", "button");

    var actions = appendNode(card, "div", "mp-provider-card-actions");

    var saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-outline mp-save-btn";
    saveBtn.textContent = "Save listing";
    saveBtn.addEventListener("click", function () {
      saveListing(listing.id, listing.title, saveBtn);
    });
    actions.appendChild(saveBtn);

    var contactBtn = document.createElement("button");
    contactBtn.className = "btn btn-primary mp-contact-btn";
    contactBtn.textContent = "Contact agent";
    contactBtn.addEventListener("click", function () {
      contactAgent(listing.id, listing.title || "this listing", contactBtn);
    });
    actions.appendChild(contactBtn);
  }

  async function saveListing(listingId, listingTitle, btn) {
    var token = await getAccessToken();
    if (!token) {
      btn.textContent = "Sign in to save";
      setTimeout(function () { btn.textContent = "Save listing"; }, 2000);
      return;
    }
    btn.disabled = true;
    btn.textContent = "Saving...";
    try {
      var res = await fetch(getApiBaseUrl() + "/saved-properties", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ listing_id: listingId, intent_data: { listing_title: listingTitle } })
      });
      btn.textContent = res.ok ? "Saved!" : "Save listing";
      if (!res.ok) btn.disabled = false;
    } catch (err) {
      btn.textContent = "Save listing";
      btn.disabled = false;
    }
  }

  async function contactAgent(listingId, listingTitle, btn) {
    var token = await getAccessToken();
    if (!token) {
      btn.textContent = "Sign in first";
      setTimeout(function () { btn.textContent = "Contact agent"; }, 2000);
      return;
    }
    btn.disabled = true;
    btn.textContent = "Sending...";
    try {
      var res = await fetch(getApiBaseUrl() + "/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({
          intent_data: { source: "marketplace", listing_title: listingTitle, listing_id: listingId }
        })
      });
      btn.textContent = res.ok ? "Agent contacted!" : "Contact agent";
      if (!res.ok) btn.disabled = false;
    } catch (err) {
      btn.textContent = "Contact agent";
      btn.disabled = false;
    }
  }

  function renderProviderListings(response) {
    var grid = document.getElementById("mpProviderListingsGrid");
    var emptyEl = document.getElementById("mpProviderListingsEmpty");
    var statusEl = document.getElementById("mpProviderListingsStatus");
    var results = Array.isArray(response.results) ? response.results : [];
    var responseMode = getListingDisplayMode(response);
    var filters = getProviderListingsFilterState();

    clearNode(grid);

    if (isRepliersPreviewResponse(response) && !results.length) {
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = response.providerStatus === "preview_ready"
          ? "No provider listings matched these filters in the current data access mode. Try a broader location or adjust price/property type."
          : "Repliers preview access is not configured or unavailable. No provider listings are shown.";
      }
      var statusMessage = "Provider status: " +
        formatBlockedReason(response.providerStatus || "preview_not_configured") +
        ". " +
        (response.disclaimer || "Repliers preview/sample data is not live MLS listing data.");
      if (response.blockedReason) {
        statusMessage += " " + formatBlockedReason(response.blockedReason) + ".";
      }
      setProviderStatus(
        statusEl,
        response.providerStatus === "preview_ready" ? "ready" : "pending",
        statusMessage
      );
      renderProviderFilterSummary(filters, 0);
      return;
    }

    if (emptyEl) {
      emptyEl.hidden = results.length > 0;
      if (!results.length) {
        emptyEl.textContent = responseMode === "production"
          ? "No provider listings match those filters yet."
          : "No provider listings match those filters yet.";
      }
    }
    setProviderStatus(statusEl, "ready", response.disclaimer || "Provider listings are shown from Kimure's listings contract.");
    renderProviderFilterSummary(filters, results.length);

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
      emptyEl.textContent = "No listings match those filters yet.";
      clearNode(grid);
      setProviderStatus(statusEl, "loading", "Loading listings...");

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
    var raw = String(value || "").trim();
    var corrected = raw.replace(/[$\s]/g, "");
    if (/^\d{3},\d{2}$/.test(corrected)) corrected += "0";
    var normalized = corrected.replace(/,/g, "");
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

  function getSelectedListingsProvider() {
    var selector = document.getElementById("mpProviderSelector");
    if (!selector) return "repliers_preview";
    return selector.value === "repliers_preview" ? "repliers_preview" : "repliers_preview";
  }

  function marketplaceAiMetadata() {
    var provider = getSelectedListingsProvider();
    return {
      source: "marketplace_ai_tools",
      listingProvider: provider || "repliers_preview",
      provider: provider || "repliers_preview",
      listingFilters: getProviderListingsFilterState()
    };
  }

  function selectedListingProviderFields() {
    var provider = getSelectedListingsProvider() || "repliers_preview";
    return {
      provider: provider,
      listingProvider: provider
    };
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
    var listingProvider = getSelectedListingsProvider();
    var metadata = marketplaceAiMetadata();
    var selectedProviderFields = selectedListingProviderFields();

    if (tool === "scout") {
      return {
        provider: selectedProviderFields.provider,
        listingProvider: selectedProviderFields.listingProvider,
        question: "Find matching properties for this marketplace search.",
        filters: {
          location: location,
          maxPrice: budget || undefined,
          preferences: goals,
          provider: listingProvider || undefined
        },
        goals: goals,
        metadata: metadata
      };
    }

    if (tool === "analyze") {
      return {
        provider: selectedProviderFields.provider,
        listingProvider: selectedProviderFields.listingProvider,
        question: "Analyze this property for fit, risk, and investment reasoning.",
        listing: {
          address: address,
          price: price,
          details: details,
          provider: listingProvider || undefined
        },
        goals: goals,
        metadata: metadata
      };
    }

    if (tool === "rental") {
      return {
        provider: selectedProviderFields.provider,
        listingProvider: selectedProviderFields.listingProvider,
        question: "Find rental fit based on this user profile.",
        filters: {
          location: location,
          monthlyBudget: monthlyBudget,
          needs: needs,
          provider: listingProvider || undefined
        },
        goals: splitList(needs),
        metadata: metadata
      };
    }

    if (tool === "valuate") {
      return {
        provider: selectedProviderFields.provider,
        listingProvider: selectedProviderFields.listingProvider,
        question: "Estimate a directional property value range.",
        property: {
          address: address,
          details: details,
          price: price,
          provider: listingProvider || undefined
        },
        metadata: metadata
      };
    }

    if (tool === "investment-planner") {
      return {
        provider: selectedProviderFields.provider,
        listingProvider: selectedProviderFields.listingProvider,
        question: "Create a property investment planning snapshot.",
        goals: goals,
        financials: {
          availableFunds: availableFunds
        },
        context: {
          timeline: timeline,
          provider: listingProvider || undefined
        },
        metadata: metadata
      };
    }

    return {
      provider: selectedProviderFields.provider,
      listingProvider: selectedProviderFields.listingProvider,
      question: question,
      message: question,
      context: {
        provider: listingProvider || undefined
      },
      metadata: metadata
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
    var listingContext = safeObject(reportData.listingContext);
    if (listingContext.source) {
      appendText(
        resultEl,
        "p",
        "mp-ai-context-note",
        "AI provider context: " + formatAiProviderContextLabel(listingContext.source)
      );
    }

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
