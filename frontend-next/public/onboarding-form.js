(function () {
  "use strict";

  var form = document.getElementById("onboardingWizard");
  if (!form) return;

  var steps = form.querySelectorAll(".onb-form-step");
  var total = steps.length;
  var current = 1;
  var numEl = document.getElementById("currentStepNum");
  var barFill = document.querySelector(".onb-progress-fill");
  var backBtn = form.querySelector(".onb-back");
  var nextBtn = form.querySelector(".onb-next");

  function validateStep1() {
    var email = form.querySelector("#onb-email");
    var pass = form.querySelector("#onb-password");
    var confirm = form.querySelector("#onb-password-confirm");
    var terms = form.querySelector("#onb-terms");
    if (email && !email.value.trim()) {
      alert("Please enter your email.");
      return false;
    }
    if (pass && (!pass.value || pass.value.length < 8)) {
      alert("Please enter a password (at least 8 characters).");
      return false;
    }
    if (pass && confirm && pass.value !== confirm.value) {
      alert("Passwords do not match.");
      return false;
    }
    if (terms && !terms.checked) {
      alert("Please agree to the Terms & Conditions.");
      return false;
    }
    return true;
  }

  function t(key, fallback) {
    var d = window.KIMURE_I18N_DICT;
    if (d && d[key] != null) return d[key];
    return fallback;
  }

  function updateNav() {
    if (numEl) numEl.textContent = String(current);
    if (barFill) barFill.style.width = ((current / total) * 100).toFixed(1) + "%";
    if (backBtn) {
      backBtn.hidden = current === 1;
      backBtn.textContent = t("onb.wiz.back", "Back");
    }
    if (!nextBtn) return;
    if (current === total) {
      nextBtn.textContent = t("onb.wiz.finish", "Finish");
    } else if (current === 8) {
      nextBtn.textContent = t("onb.wiz.getMatches", "Get My AI Matches");
    } else if (current === 1) {
      nextBtn.textContent = t("onb.wiz.create", "Create My Account");
    } else {
      nextBtn.textContent = t("onb.wiz.next", "Next");
    }
  }

  function showStep(n) {
    current = Math.min(Math.max(1, n), total);
    steps.forEach(function (el) {
      var s = parseInt(el.getAttribute("data-step"), 10);
      var active = s === current;
      el.classList.toggle("is-active", active);
      el.setAttribute("aria-hidden", active ? "false" : "true");
    });
    updateNav();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function goNext() {
    if (current === 1) {
      if (!validateStep1()) return;
      if (window.KIMURE_AUTH && form.dataset.authSignupComplete !== "true") {
        var signedUp = await window.KIMURE_AUTH.signUpFromOnboarding(form, nextBtn);
        if (!signedUp) return;
        form.dataset.authSignupComplete = "true";
      }
    }
    if (current >= total) {
      alert("Thank you! Your Smart Onboarding is complete. (Demo — connect to your backend to save data.)");
      return;
    }
    showStep(current + 1);
  }

  function goBack() {
    showStep(current - 1);
  }

  if (backBtn) backBtn.addEventListener("click", goBack);
  if (nextBtn) nextBtn.addEventListener("click", function (e) {
    e.preventDefault();
    goNext();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    goNext();
  });

  document.addEventListener("kimure-i18n-applied", function () {
    updateNav();
  });

  showStep(1);
})();
