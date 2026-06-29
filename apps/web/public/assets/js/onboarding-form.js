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
  var aiRecommendation = null;
  var aiRecommendationReady = false;
  var aiRequestInFlight = false;

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

  function selectedValue(name) {
    var input = form.querySelector('input[name="' + name + '"]:checked');
    return input ? input.value : "";
  }

  function checkedValues(name) {
    return Array.prototype.slice.call(form.querySelectorAll('input[name="' + name + '"]:checked')).map(function (input) {
      return input.value;
    });
  }

  function textValue(selector) {
    var input = form.querySelector(selector);
    return input && input.value ? input.value.trim() : "";
  }

  function numberValue(selector) {
    var input = form.querySelector(selector);
    if (!input || input.value === "") return null;
    var parsed = Number(input.value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function budgetRange(value) {
    var ranges = {
      under50k: [0, 50000],
      "50k-150k": [50000, 150000],
      "150k-500k": [150000, 500000],
      "500k-1m": [500000, 1000000],
      "1mplus": [1000000, null]
    };
    return ranges[value] || [null, null];
  }

  function budgetLabel(value) {
    var labels = {
      under50k: "Under $50,000",
      "50k-150k": "$50,000 – $150,000",
      "150k-500k": "$150,000 – $500,000",
      "500k-1m": "$500,000 – $1M",
      "1mplus": "$1M+"
    };
    return labels[value] || "";
  }

  function chooseOnboardingAiTool(answers) {
    var goal = answers.goal || "";
    var propertyTypes = answers.propertyTypes || [];
    var returnGoals = answers.returnGoals || [];

    if (goal === "renting") return "rental";
    if (goal === "investing" || returnGoals.length) return "investment-planner";
    if (propertyTypes.indexOf("land") >= 0 || propertyTypes.indexOf("farm") >= 0 || goal === "building") return "scout";
    if (goal === "buying") return "scout";
    return "chat";
  }

  function plainToolLabel(tool) {
    var labels = {
      scout: "Property Match Recommendation",
      rental: "Rental Fit Recommendation",
      "investment-planner": "Investment Planning Recommendation",
      chat: "Kimure Recommendation"
    };
    return labels[tool] || "Kimure Recommendation";
  }

  function collectOnboardingAnswers() {
    var budgetKey = selectedValue("budget");
    var range = budgetRange(budgetKey);
    var locCountry = textValue("#onb-loc-country");
    var locCity = textValue("#onb-loc-city");

    return {
      goal: selectedValue("goal"),
      propertyTypes: checkedValues("property_type"),
      budgetKey: budgetKey,
      budgetLabel: budgetLabel(budgetKey),
      budgetMin: range[0],
      budgetMax: range[1],
      locationCountry: locCountry,
      locationCity: locCity,
      timeline: selectedValue("timeline"),
      availableFunds: numberValue("#onb-funds"),
      monthlyRentalIncome: numberValue("#onb-rental-income"),
      returnGoals: checkedValues("return_goal")
    };
  }

  function buildOnboardingAiPayload() {
    var answers = collectOnboardingAnswers();
    var aiTool = chooseOnboardingAiTool(answers);
    var goals = [answers.goal].concat(answers.returnGoals || []).filter(Boolean);
    var location = [answers.locationCity, answers.locationCountry].filter(Boolean).join(", ");

    return {
      tool: aiTool,
      payload: {
        question: "Generate a Smart Onboarding recommendation and practical next steps from this Kimure user profile.",
        onboarding: {
          goal: answers.goal || null,
          timeline: answers.timeline || null,
          budgetLabel: answers.budgetLabel || null,
          propertyTypes: answers.propertyTypes,
          locationPreference: location || null
        },
        financials: {
          budgetMin: answers.budgetMin,
          budgetMax: answers.budgetMax,
          availableFunds: answers.availableFunds,
          monthlyRentalIncome: answers.monthlyRentalIncome
        },
        goals: goals,
        filters: {
          location: location || undefined,
          maxPrice: answers.budgetMax || undefined,
          propertyType: answers.propertyTypes[0] || undefined,
          preferences: answers.propertyTypes
        },
        property: {
          assetTypes: answers.propertyTypes
        },
        context: {
          source: "smart_onboarding",
          selectedPath: answers.goal || "general",
          timeline: answers.timeline || null
        },
        metadata: {
          source: "smart_onboarding",
          smartOnboarding: true,
          routedTool: aiTool,
          resultPlacement: "onboarding_step_9"
        },
        consent: {
          userProvidedProfileData: true
        }
      }
    };
  }

  function setAiStatus(message, type) {
    var status = document.getElementById("onbAiStatus");
    if (!status) return;
    status.textContent = message || "";
    status.classList.remove("is-loading", "is-error", "is-success");
    if (type) status.classList.add(type);
    status.hidden = !message;
  }

  function appendText(parent, tagName, className, text) {
    if (!parent || !text) return null;
    var node = document.createElement(tagName);
    if (className) node.className = className;
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function appendList(parent, title, items) {
    if (!Array.isArray(items) || !items.length) return;
    appendText(parent, "h4", "", title);
    var list = document.createElement("ul");
    items.slice(0, 5).forEach(function (item) {
      if (typeof item !== "string" || !item.trim()) return;
      appendText(list, "li", "", item.trim());
    });
    if (list.children.length) parent.appendChild(list);
  }

  function normalizeResultArray(value) {
    return Array.isArray(value)
      ? value.filter(function (item) { return typeof item === "string" && item.trim(); })
      : [];
  }

  function safeAiSummary(data) {
    return data && typeof data.summary === "string" && data.summary.trim()
      ? data.summary.trim()
      : "Kimure generated a recommendation from your onboarding answers.";
  }

  function renderAiRecommendationCard(target, result) {
    if (!target) return;
    while (target.firstChild) target.removeChild(target.firstChild);

    if (!result || !result.data) {
      target.hidden = true;
      return;
    }

    var data = result.data;
    var reportData = data.reportData && typeof data.reportData === "object" && !Array.isArray(data.reportData)
      ? data.reportData
      : {};
    var nextSteps = normalizeResultArray(data.nextSteps)
      .concat(normalizeResultArray(data.nextBestActions))
      .concat(normalizeResultArray(reportData.nextSteps))
      .concat(normalizeResultArray(reportData.nextBestActions));

    appendText(target, "h3", "", result.label || plainToolLabel(data.tool));
    appendText(target, "p", "", safeAiSummary(data));

    var meta = document.createElement("div");
    meta.className = "onb-ai-result-meta";
    if (typeof data.score === "number") appendText(meta, "span", "onb-ai-pill", "Fit score: " + data.score);
    if (typeof data.riskLevel === "string" && data.riskLevel) appendText(meta, "span", "onb-ai-pill", "Risk: " + data.riskLevel);
    if (data.tool) appendText(meta, "span", "onb-ai-pill", "Path: " + plainToolLabel(data.tool));
    if (meta.children.length) target.appendChild(meta);

    appendList(target, "Key reasons", normalizeResultArray(data.keyInsights));
    appendList(target, "Recommendations", normalizeResultArray(data.recommendations));
    appendList(target, "Next steps", nextSteps);
    appendText(target, "p", "onb-step-note onb-step-note--tight", typeof data.disclaimer === "string" ? data.disclaimer : "");
    target.hidden = false;
  }

  function renderAiRecommendationResults() {
    renderAiRecommendationCard(document.getElementById("onbAiStep8Preview"), aiRecommendation);
    renderAiRecommendationCard(document.getElementById("onbAiResultsPanel"), aiRecommendation);
  }

  async function runAiRecommendationFlow() {
    if (aiRequestInFlight) return;
    aiRequestInFlight = true;
    aiRecommendationReady = false;
    aiRecommendation = null;
    renderAiRecommendationResults();
    setAiStatus("Generating AI matches…", "is-loading");
    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.textContent = "Generating AI matches…";
    }

    try {
      if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.requestAiTool) {
        throw new Error("missing_ai_helper");
      }

      if (window.KIMURE_AUTH.saveOnboardingProfile) {
        var saveResult = await window.KIMURE_AUTH.saveOnboardingProfile(form, null);
        if (!saveResult || !saveResult.ok) {
          setAiStatus(
            saveResult && saveResult.message
              ? saveResult.message
              : "Please sign in before generating AI recommendations.",
            "is-error"
          );
          return;
        }
      }

      var request = buildOnboardingAiPayload();
      var aiResult = await window.KIMURE_AUTH.requestAiTool(request.tool, request.payload);
      if (!aiResult || !aiResult.ok) {
        setAiStatus(
          "AI recommendations could not be generated right now. Please try again.",
          "is-error"
        );
        return;
      }

      aiRecommendation = {
        label: plainToolLabel(request.tool),
        data: aiResult.data
      };
      aiRecommendationReady = true;
      renderAiRecommendationResults();
      setAiStatus("AI matches generated. Review the recommendation, then continue.", "is-success");
    } catch (err) {
      setAiStatus("AI recommendations could not be generated right now. Please try again.", "is-error");
    } finally {
      aiRequestInFlight = false;
      updateNav();
    }
  }

  async function handleAiRecommendationStep() {
    if (aiRecommendationReady) {
      showStep(9);
      return;
    }
    await runAiRecommendationFlow();
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
      nextBtn.textContent = aiRecommendationReady
        ? t("onb.wiz.next", "Continue")
        : t("onb.wiz.getMatches", "Get My AI Matches");
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
    renderAiRecommendationResults();
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
    if (current === 8) {
      await handleAiRecommendationStep();
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
