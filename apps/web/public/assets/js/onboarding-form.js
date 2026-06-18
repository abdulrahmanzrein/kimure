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
  var step1El = form.querySelector('[data-step="1"]');
  var signedInNotice = null;
  var signedInUser = null;
  var existingProfilePanel = null;
  var existingProfile = null;
  var progressWrap = document.querySelector(".onb-progress-wrap");
  var emailConfirmPanel = null;
  var pendingSignupEmail = "";

  function isAwaitingEmailConfirmation() {
    return form.dataset.emailConfirmationPending === "true";
  }

  function validateStep1() {
    if (form.dataset.authSignupComplete === "true") return true;

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

  function isAlreadySignedIn() {
    return form.dataset.authSignupComplete === "true" && !!signedInUser;
  }

  function ensureSignedInNotice() {
    if (!step1El) return null;
    if (signedInNotice) return signedInNotice;

    signedInNotice = document.createElement("p");
    signedInNotice.className = "onb-step-note onb-signed-in-notice";
    signedInNotice.setAttribute("role", "status");
    signedInNotice.hidden = true;
    step1El.insertBefore(signedInNotice, step1El.children[1] || null);
    return signedInNotice;
  }

  function applySignedInStep1(user) {
    clearEmailConfirmationState();
    signedInUser = user;
    form.dataset.authSignupComplete = "true";

    var email = form.querySelector("#onb-email");
    if (email && user.email) email.value = user.email;

    if (step1El) step1El.classList.add("is-signed-in");

    var notice = ensureSignedInNotice();
    if (notice) {
      notice.textContent =
        "You're already signed in as " +
        (user.email || "your account") +
        ". Continue to complete your profile.";
      notice.hidden = false;
    }
  }

  function setEmailConfirmStatus(message, type) {
    if (!emailConfirmPanel) return;
    var status = emailConfirmPanel.querySelector(".onb-email-confirm-status");
    if (!status) return;
    status.textContent = message || "";
    status.classList.remove("is-error", "is-success");
    if (type) status.classList.add(type);
    status.hidden = !message;
  }

  function clearEmailConfirmationState() {
    form.dataset.emailConfirmationPending = "";
    pendingSignupEmail = "";
    if (step1El) step1El.classList.remove("is-email-confirm");
    if (emailConfirmPanel) emailConfirmPanel.hidden = true;
    setEmailConfirmStatus("");
  }

  function ensureEmailConfirmPanel() {
    if (!step1El) return null;
    if (emailConfirmPanel) return emailConfirmPanel;

    emailConfirmPanel = document.createElement("div");
    emailConfirmPanel.className = "onb-email-confirm-panel";
    emailConfirmPanel.hidden = true;
    emailConfirmPanel.innerHTML =
      '<p class="onb-step-note onb-email-confirm-notice" role="status">' +
      "Check your email and click the confirmation link before continuing." +
      "</p>" +
      '<p class="onb-step-note">We sent a confirmation link to <strong class="js-onb-confirm-email"></strong>.</p>' +
      '<div class="onb-email-confirm-actions">' +
      '<button type="button" class="btn btn-outline js-onb-resend-confirm">Resend confirmation email</button>' +
      "</div>" +
      '<div class="onb-field">' +
      '<label for="onb-confirm-password">Password</label>' +
      '<input type="password" id="onb-confirm-password" autocomplete="current-password" placeholder="Enter the password you just created" />' +
      "</div>" +
      '<div class="onb-email-confirm-actions">' +
      '<button type="button" class="btn btn-primary js-onb-confirm-continue">Sign in and continue</button>' +
      "</div>" +
      '<p class="onb-email-confirm-status" hidden></p>';

    var resendBtn = emailConfirmPanel.querySelector(".js-onb-resend-confirm");
    var continueBtn = emailConfirmPanel.querySelector(".js-onb-confirm-continue");
    var confirmPassword = emailConfirmPanel.querySelector("#onb-confirm-password");

    if (resendBtn) {
      resendBtn.addEventListener("click", async function () {
        if (!pendingSignupEmail || !window.KIMURE_AUTH || !window.KIMURE_AUTH.resendSignupConfirmation) {
          setEmailConfirmStatus("Unable to resend confirmation email right now.", "is-error");
          return;
        }
        resendBtn.disabled = true;
        var result = await window.KIMURE_AUTH.resendSignupConfirmation(pendingSignupEmail);
        resendBtn.disabled = false;
        if (result.error) {
          setEmailConfirmStatus(result.error.message, "is-error");
          return;
        }
        setEmailConfirmStatus("Confirmation email sent again. Check your inbox.", "is-success");
      });
    }

    if (continueBtn) {
      continueBtn.addEventListener("click", async function () {
        await completeEmailConfirmationAndContinue(confirmPassword, continueBtn);
      });
    }

    step1El.appendChild(emailConfirmPanel);
    return emailConfirmPanel;
  }

  function showEmailConfirmationStep(email) {
    pendingSignupEmail = email || "";
    form.dataset.emailConfirmationPending = "true";
    form.dataset.pendingSignupEmail = pendingSignupEmail;

    if (step1El) step1El.classList.add("is-email-confirm");

    var panel = ensureEmailConfirmPanel();
    if (panel) {
      var emailTarget = panel.querySelector(".js-onb-confirm-email");
      if (emailTarget) emailTarget.textContent = pendingSignupEmail;
      panel.hidden = false;
    }

    setEmailConfirmStatus("After you confirm your email, sign in below to continue onboarding.", "");
    showStep(1);
    updateNav();
  }

  async function completeEmailConfirmationAndContinue(passwordInput, button) {
    if (!pendingSignupEmail) {
      setEmailConfirmStatus("Missing signup email. Please start registration again.", "is-error");
      return;
    }

    var passwordValue = passwordInput && passwordInput.value ? passwordInput.value : "";
    var fallbackPassword = form.querySelector("#onb-password");
    if (!passwordValue && fallbackPassword && fallbackPassword.value) {
      passwordValue = fallbackPassword.value;
    }

    if (!passwordValue) {
      setEmailConfirmStatus("Enter your password to continue.", "is-error");
      return;
    }

    if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.signIn) {
      setEmailConfirmStatus("Auth is not loaded on this page.", "is-error");
      return;
    }

    if (button) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = "Signing in...";
    }

    var result = await window.KIMURE_AUTH.signIn(pendingSignupEmail, passwordValue);

    if (button) {
      button.disabled = false;
      button.textContent = button.dataset.originalText || "Sign in and continue";
    }

    if (result.error) {
      var msg = result.error.message || "Could not sign in yet.";
      if (msg.toLowerCase().indexOf("email not confirmed") >= 0) {
        msg = "Your email is not confirmed yet. Click the link in your inbox, then try again.";
      }
      setEmailConfirmStatus(msg, "is-error");
      return;
    }

    if (result.data && result.data.user) {
      applySignedInStep1(result.data.user);
      showStep(2);
    }
  }

  function ensureExistingProfilePanel() {
    if (existingProfilePanel) return existingProfilePanel;

    existingProfilePanel = document.createElement("div");
    existingProfilePanel.className = "onb-existing-profile-panel";
    existingProfilePanel.hidden = true;
    existingProfilePanel.setAttribute("role", "region");
    existingProfilePanel.setAttribute("aria-label", "Onboarding already complete");
    existingProfilePanel.innerHTML =
      '<h2>Onboarding already complete</h2>' +
      '<p>You already saved your Smart Onboarding answers. What would you like to do next?</p>' +
      '<div class="onb-existing-profile-actions">' +
      '<button type="button" class="btn btn-primary js-onb-edit-profile">Edit my answers</button>' +
      '<a href="marketplace.html" class="btn btn-outline">Go to marketplace</a>' +
      "</div>";

    var editBtn = existingProfilePanel.querySelector(".js-onb-edit-profile");
    if (editBtn) {
      editBtn.addEventListener("click", function () {
        startEditingExistingProfile();
      });
    }

    if (progressWrap && progressWrap.parentNode) {
      progressWrap.parentNode.insertBefore(existingProfilePanel, form);
    } else {
      form.parentNode.insertBefore(existingProfilePanel, form);
    }

    return existingProfilePanel;
  }

  function showExistingProfileChoice(profile) {
    existingProfile = profile;
    var panel = ensureExistingProfilePanel();
    panel.hidden = false;
    form.classList.add("is-choice-mode");
    if (progressWrap) progressWrap.hidden = true;
  }

  function hideExistingProfileChoice() {
    if (existingProfilePanel) existingProfilePanel.hidden = true;
    form.classList.remove("is-choice-mode");
    if (progressWrap) progressWrap.hidden = false;
  }

  function startEditingExistingProfile() {
    if (
      existingProfile &&
      window.KIMURE_AUTH &&
      window.KIMURE_AUTH.applyOnboardingProfileToForm
    ) {
      window.KIMURE_AUTH.applyOnboardingProfileToForm(form, existingProfile);
    }
    hideExistingProfileChoice();
    showStep(2);
  }

  function updateNav() {
    if (numEl) numEl.textContent = String(current);
    if (barFill) barFill.style.width = ((current / total) * 100).toFixed(1) + "%";
    if (backBtn) {
      backBtn.hidden = current === 1;
      backBtn.textContent = t("onb.wiz.back", "Back");
    }
    if (!nextBtn) return;
    nextBtn.disabled = false;
    if (current === total) {
      nextBtn.textContent = t("onb.wiz.finish", "Finish");
    } else if (current === 8) {
      nextBtn.textContent = t("onb.wiz.getMatches", "Get My AI Matches");
    } else if (current === 1 && isAwaitingEmailConfirmation()) {
      nextBtn.textContent = "Waiting for email confirmation";
      nextBtn.disabled = true;
    } else if (current === 1 && isAlreadySignedIn()) {
      nextBtn.textContent = t("onb.wiz.next", "Continue");
    } else if (current === 1) {
      nextBtn.textContent = t("onb.wiz.create", "Create My Account");
      nextBtn.disabled = false;
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
      if (isAwaitingEmailConfirmation()) return;
      if (isAlreadySignedIn()) {
        showStep(2);
        return;
      }
      if (!validateStep1()) return;
      if (window.KIMURE_AUTH && form.dataset.authSignupComplete !== "true") {
        var signupResult = await window.KIMURE_AUTH.signUpFromOnboarding(form, nextBtn);
        if (!signupResult || !signupResult.ok) {
          if (signupResult && signupResult.error) {
            alert(signupResult.error.message);
          }
          return;
        }
        if (signupResult.needsEmailConfirmation) {
          showEmailConfirmationStep(signupResult.email);
          return;
        }
        if (signupResult.user) {
          applySignedInStep1(signupResult.user);
        }
        form.dataset.authSignupComplete = "true";
      }
    }
    if (current >= total) {
      if (window.KIMURE_AUTH) {
        var saveResult = await window.KIMURE_AUTH.saveOnboardingProfile(form, nextBtn);
        if (!saveResult || !saveResult.ok) {
          if (saveResult && saveResult.message) {
            alert(saveResult.message);
          }
          return;
        }
      }
      alert("Thank you! Your Smart Onboarding is complete.");
      return;
    }
    showStep(current + 1);
  }

  function goBack() {
    showStep(current - 1);
  }

  async function initAuthState() {
    if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.getCurrentUser) {
      showStep(1);
      return;
    }

    var user = await window.KIMURE_AUTH.getCurrentUser();
    if (!user) {
      if (form.dataset.pendingSignupEmail) {
        showEmailConfirmationStep(form.dataset.pendingSignupEmail);
        return;
      }
      showStep(1);
      return;
    }

    applySignedInStep1(user);

    if (window.KIMURE_AUTH.fetchOnboardingProfile) {
      var profile = await window.KIMURE_AUTH.fetchOnboardingProfile(user.id);
      if (profile) {
        showExistingProfileChoice(profile);
        return;
      }
    }

    showStep(2);
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

  document.addEventListener("kimure-auth-changed", function (e) {
    var user = e.detail && e.detail.user ? e.detail.user : null;
    if (user) {
      applySignedInStep1(user);
      if (current === 1) showStep(2);
      return;
    }
    signedInUser = null;
    existingProfile = null;
    form.dataset.authSignupComplete = "";
    clearEmailConfirmationState();
    hideExistingProfileChoice();
    if (step1El) step1El.classList.remove("is-signed-in");
    if (signedInNotice) signedInNotice.hidden = true;
  });

  initAuthState();
})();
