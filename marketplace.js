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
})();
