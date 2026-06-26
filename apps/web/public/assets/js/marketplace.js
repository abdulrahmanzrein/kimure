(function () {
  "use strict";

  // Where the backend lives (same config the onboarding flow uses).
  var config = window.KIMURE_SUPABASE_CONFIG || {};
  var apiBaseUrl = config.apiBaseUrl || "http://localhost:3001/api";

  var form = document.getElementById("mpSearchForm");
  var input = document.getElementById("mpSearchInput");
  var featuredGrid = document.getElementById("mpFeaturedGrid");

  // The four intent tabs below the featured grid. Cards get cloned into these
  // based on their data-modes attribute.
  var blocks = [
    { mode: "buy", grid: document.getElementById("mpGridBuy"), emptyEl: document.getElementById("mpEmptyBuy") },
    { mode: "sale", grid: document.getElementById("mpGridSale"), emptyEl: document.getElementById("mpEmptySale") },
    { mode: "rent", grid: document.getElementById("mpGridRent"), emptyEl: document.getElementById("mpEmptyRent") },
    { mode: "invest", grid: document.getElementById("mpGridInvest"), emptyEl: document.getElementById("mpEmptyInvest") },
  ];

  if (!featuredGrid || blocks.some(function (b) { return !b.grid || !b.emptyEl; })) return;

  // ---------------------------------------------------------------------------
  // Helpers for turning an API listing into a card
  // ---------------------------------------------------------------------------

  // Short money label: 1420000 -> "$1.42M", 860000 -> "$860K".
  function formatPrice(price) {
    if (price == null) return "Price on request";
    if (price >= 1000000) return "$" + (price / 1000000).toFixed(2).replace(/\.?0+$/, "") + "M";
    if (price >= 1000) return "$" + Math.round(price / 1000) + "K";
    return "$" + price;
  }

  // The database has no Buy/Sale/Rent/Invest concept — those are just frontend
  // tabs — so we derive which tabs a listing belongs in from its type.
  function modesForType(type) {
    var t = (type || "").toLowerCase();
    if (t.indexOf("agri") >= 0 || t.indexOf("land") >= 0 || t.indexOf("rural") >= 0) {
      return "buy sale invest";
    }
    if (t.indexOf("commercial") >= 0) return "buy sale rent invest";
    return "buy sale rent"; // residential / urban / anything else
  }

  // Build one <article> card from an API listing object. Text from the database
  // is set via textContent (not innerHTML) so a listing title can't inject markup.
  function buildCard(listing) {
    var meta = listing.metadata || {};
    var roi = meta.roi;
    var fit = listing.ai_score;
    var image = meta.image || "assets/images/listings/urban-apartment.jpg";

    var article = document.createElement("article");
    article.className = "mp-listing-card";
    article.setAttribute("data-modes", modesForType(listing.listing_type));
    article.setAttribute("data-type", listing.listing_type || "");
    article.setAttribute("data-location", listing.location || "");
    if (listing.price != null) article.setAttribute("data-price", listing.price);
    if (roi != null) article.setAttribute("data-roi", roi);
    // What the search box matches against.
    article.setAttribute(
      "data-search",
      [listing.title, listing.listing_type, listing.location, formatPrice(listing.price), roi != null ? roi + "% roi" : ""]
        .join(" ")
        .toLowerCase()
    );

    // Gold badge: prefer an ROI figure, else the AI fit score, else nothing.
    var goldBadge = roi != null ? "ROI " + roi + "%" : fit != null ? "Fit " + fit + "%" : "";
    var metaLine = [listing.listing_type, listing.location].filter(Boolean).join(" • ");

    // Static skeleton first...
    article.innerHTML =
      '<div class="mp-listing-thumb">' +
      '  <img alt="" width="800" height="533" loading="lazy" decoding="async" />' +
      "</div>" +
      '<div class="mp-listing-top">' +
      '  <span class="badge">Verified</span>' +
      (goldBadge ? '  <span class="badge gold-badge"></span>' : "") +
      "</div>" +
      '<div class="mp-listing-info">' +
      '  <div class="mp-listing-price"></div>' +
      '  <div class="mp-listing-meta"></div>' +
      '  <a class="mp-listing-cta">View Details →</a>' +
      "</div>";

    // ...then fill the dynamic parts safely.
    article.querySelector(".mp-listing-thumb img").setAttribute("src", image);
    if (goldBadge) article.querySelector(".gold-badge").textContent = goldBadge;
    article.querySelector(".mp-listing-price").textContent = formatPrice(listing.price);
    article.querySelector(".mp-listing-meta").textContent = metaLine;
    article.querySelector(".mp-listing-cta").setAttribute("href", "#listing-" + listing.id);

    return article;
  }

  // ---------------------------------------------------------------------------
  // Distribution + search (same behaviour as before, just factored into funcs)
  // ---------------------------------------------------------------------------

  // Copy each featured card into the intent tabs it belongs to.
  function distributeToModes() {
    blocks.forEach(function (block) {
      block.grid.querySelectorAll(".mp-listing-card").forEach(function (c) {
        c.remove();
      });
    });

    featuredGrid.querySelectorAll(".mp-listing-card").forEach(function (card) {
      var modes = (card.getAttribute("data-modes") || "").toLowerCase().split(/\s+/).filter(Boolean);
      modes.forEach(function (m) {
        blocks.forEach(function (block) {
          if (block.mode !== m) return;
          var copy = card.cloneNode(true);
          copy.removeAttribute("id");
          block.grid.insertBefore(copy, block.emptyEl);
        });
      });
    });
  }

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

  // Search box wiring is attached immediately so it works regardless of fetch.
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

  // ---------------------------------------------------------------------------
  // Load real listings from the API, then run the existing distribute + filter.
  // If the API is empty or unreachable, the hardcoded demo cards stay as a
  // fallback so the page never looks broken.
  // ---------------------------------------------------------------------------
  function init(listings) {
    if (listings && listings.length) {
      featuredGrid.querySelectorAll(".mp-listing-card").forEach(function (c) {
        c.remove();
      });
      listings.forEach(function (listing) {
        featuredGrid.appendChild(buildCard(listing));
      });
    }
    distributeToModes();
    setQueryFromUrl();
  }

  fetch(apiBaseUrl + "/listings")
    .then(function (res) {
      return res.ok ? res.json() : [];
    })
    .then(function (listings) {
      init(Array.isArray(listings) ? listings : []);
    })
    .catch(function () {
      init([]); // backend down -> keep the demo cards
    });
})();
