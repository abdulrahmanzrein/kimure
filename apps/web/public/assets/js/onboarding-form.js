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
  var aiRecommendationComplete = false;
  var aiResult = document.getElementById("onbAiResult");
  var aiStatus = document.getElementById("onbAiStatus");
  var aiLoading = document.getElementById("onbAiLoading");

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

  function selectedValue(name) {
    var input = form.querySelector('input[name="' + name + '"]:checked');
    return input ? input.value : "";
  }

  function checkedValues(name) {
    return Array.prototype.slice.call(
      form.querySelectorAll('input[name="' + name + '"]:checked')
    ).map(function (input) {
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
    var number = Number(input.value);
    return Number.isFinite(number) ? number : null;
  }

  function getBudgetRange(value) {
    var ranges = {
      under50k: [0, 50000],
      "50k-150k": [50000, 150000],
      "150k-500k": [150000, 500000],
      "500k-1m": [500000, 1000000],
      "1mplus": [1000000, null]
    };
    return ranges[value] || [null, null];
  }

  function selectAiTool(state) {
    var goals = state.goals;

    // Priority: mortgage readiness, investment planning, credit readiness,
    // property matching, then general chat. Routes requiring financial inputs
    // are selected only when those required inputs are actually available.
    if (goals.indexOf("mortgage-affordability") >= 0 &&
        state.financials.annualGross && state.financials.monthlyDebt != null) {
      return "mortgage";
    }
    if (goals.indexOf("investing") >= 0 ||
        goals.indexOf("long") >= 0 ||
        goals.indexOf("short") >= 0 ||
        goals.indexOf("rental") >= 0) {
      return "investment-planner";
    }
    if (goals.indexOf("buying") >= 0 &&
        state.financials.annualGross && state.financials.monthlyDebt != null) {
      return "credit-profile";
    }
    if (state.onboarding.intent ||
        state.property.types.length ||
        state.filters.country ||
        state.filters.city) {
      return "scout";
    }
    return "chat";
  }

  function getAiQuestion(tool, state) {
    var location = [state.filters.city, state.filters.country]
      .filter(Boolean)
      .join(", ");
    var locationText = location ? " in " + location : "";

    if (tool === "investment-planner") {
      return "Create a practical investment plan from my onboarding goals, budget, property interests, and timeline" + locationText + ".";
    }
    if (tool === "mortgage") {
      return "Estimate mortgage affordability from the financial and property information in my onboarding profile.";
    }
    if (tool === "credit-profile") {
      return "Provide a directional credit-readiness assessment from my self-reported financial profile.";
    }
    if (tool === "scout") {
      return "Recommend the best property search direction and next steps from my onboarding preferences" + locationText + ".";
    }
    return "Review my onboarding profile and recommend the most useful next step in Kimure.";
  }

  function buildAiRequest() {
    var intent = selectedValue("goal");
    var budget = getBudgetRange(selectedValue("budget"));
    var propertyTypes = checkedValues("property_type");
    var returnGoals = checkedValues("return_goal");
    var country = textValue("#onb-loc-country");
    var city = textValue("#onb-loc-city");
    var timeline = selectedValue("timeline");
    var goals = [intent].concat(returnGoals).filter(Boolean);
    var state = {
      onboarding: {
        intent: intent || null,
        budgetMin: budget[0],
        budgetMax: budget[1],
        timeline: timeline || null,
        locationPreferences: country || city
          ? [{ country: country, city: city }]
          : [],
        propertyPreferences: propertyTypes
      },
      financials: {
        availableFunds: numberValue("#onb-funds"),
        monthlyRentalIncome: numberValue("#onb-rental-income")
      },
      goals: goals,
      filters: {
        transactionType: intent || null,
        propertyTypes: propertyTypes,
        country: country || null,
        city: city || null,
        minPrice: budget[0],
        maxPrice: budget[1]
      },
      property: {
        types: propertyTypes
      },
      context: {
        profileCountry: textValue("#onb-country") || null,
        profileCity: textValue("#onb-city-profile") || null
      }
    };
    var tool = selectAiTool(state);

    return {
      tool: tool,
      payload: {
        question: getAiQuestion(tool, state),
        onboarding: state.onboarding,
        financials: state.financials,
        goals: state.goals,
        filters: state.filters,
        property: state.property,
        context: state.context,
        metadata: {
          source: "smart_onboarding",
          schemaVersion: "web-onboarding-v1"
        },
        consent: false
      }
    };
  }

  function safeObject(value) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
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

  function normalizeAiResponse(response, selectedTool) {
    var source = safeObject(response);
    var reportData = safeObject(source.reportData);
    var crmSignals = safeObject(source.crmSignals);
    var aiReasoning = safeObject(reportData.aiReasoning);
    var nextSteps = safeList(source.nextSteps);
    if (!nextSteps.length) nextSteps = safeList(reportData.nextBestActions);
    var suggestedFollowUp = safeText(crmSignals.suggestedFollowUp, null);
    if (suggestedFollowUp && nextSteps.indexOf(suggestedFollowUp) === -1) {
      nextSteps.push(suggestedFollowUp);
    }

    return {
      tool: safeText(source.tool, selectedTool),
      summary: safeText(source.summary, "No recommendation summary was returned."),
      score: typeof source.score === "number" && Number.isFinite(source.score)
        ? source.score
        : null,
      riskLevel: safeText(source.riskLevel, null),
      keyInsights: safeList(source.keyInsights),
      recommendations: safeList(source.recommendations),
      nextSteps: nextSteps.slice(0, 12),
      fallbackUsed:
        source.source === "fallback" ||
        reportData.source === "fallback" ||
        reportData.mockMode === true ||
        aiReasoning.mode === "rules_directional" ||
        (typeof reportData.geminiMode === "string" &&
          reportData.geminiMode !== "live") ||
        source.resultType === "router_fallback",
      disclaimer: safeText(
        source.disclaimer,
        "This recommendation is informational and is not professional approval or advice."
      )
    };
  }

  function getToolLabel(tool) {
    var labels = {
      chat: "Personalized Next-Step Recommendation",
      scout: "Property Match Recommendation",
      mortgage: "Mortgage Affordability Recommendation",
      "credit-profile": "Credit Readiness Recommendation",
      "investment-planner": "Investment Plan Recommendation"
    };
    return labels[tool] || "Kimure Recommendation";
  }

  function setText(id, text) {
    var element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function renderAiList(id, items, emptyMessage) {
    var list = document.getElementById(id);
    if (!list) return;
    list.replaceChildren();
    var values = items.length ? items : [emptyMessage];
    values.forEach(function (message) {
      var item = document.createElement("li");
      item.textContent = message;
      list.appendChild(item);
    });
  }

  function renderAiRecommendation(response, selectedTool) {
    var result = normalizeAiResponse(response, selectedTool);
    var scoreWrap = document.getElementById("onbAiScoreWrap");
    var riskWrap = document.getElementById("onbAiRiskWrap");
    var generationNote = document.getElementById("onbAiGenerationNote");

    setText("onbAiToolLabel", getToolLabel(result.tool));
    setText("onbAiSummary", result.summary);
    setText("onbAiScore", result.score === null ? "—" : String(result.score));
    setText("onbAiRisk", result.riskLevel || "Unknown");
    setText("onbAiDisclaimer", result.disclaimer);
    if (scoreWrap) scoreWrap.hidden = result.score === null;
    if (riskWrap) {
      riskWrap.hidden = !result.riskLevel || result.riskLevel === "unknown";
    }
    if (generationNote) generationNote.hidden = !result.fallbackUsed;
    renderAiList("onbAiInsights", result.keyInsights, "No additional insights were returned.");
    renderAiList("onbAiRecommendations", result.recommendations, "No additional recommendations were returned.");
    renderAiList("onbAiNextSteps", result.nextSteps, "Continue refining your profile for more specific guidance.");

    if (aiResult) aiResult.hidden = false;
    if (aiStatus) {
      aiStatus.textContent = "Your recommendation is ready. Continue when you are ready.";
      aiStatus.classList.remove("is-error");
    }
    if (aiResult) {
      aiResult.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function resetAiRecommendation() {
    aiRecommendationComplete = false;
    if (aiResult) aiResult.hidden = true;
    if (aiLoading) aiLoading.hidden = true;
    if (aiStatus) {
      aiStatus.textContent = "";
      aiStatus.classList.remove("is-error");
    }
  }

  function setAiLoading(loading) {
    if (!nextBtn) return;
    nextBtn.disabled = loading;
    nextBtn.textContent = loading
      ? "Generating AI matches…"
      : t("onb.wiz.getMatches", "Get My AI Matches");
    if (aiLoading) aiLoading.hidden = !loading;
    form.setAttribute("aria-busy", loading ? "true" : "false");
  }

  function showAiFailure(message, isError) {
    if (!aiStatus) return;
    aiStatus.textContent = message;
    aiStatus.classList.toggle("is-error", isError === true);
  }

  async function generateAiRecommendation() {
    if (!window.KIMURE_AUTH ||
        !window.KIMURE_AUTH.saveOnboardingProfile ||
        !window.KIMURE_AUTH.requestAiRecommendation) {
      showAiFailure(
        "AI recommendations could not be generated right now. Please try again.",
        true
      );
      return;
    }

    setAiLoading(true);
    if (aiResult) aiResult.hidden = true;
    if (aiStatus) {
      aiStatus.textContent = "";
      aiStatus.classList.remove("is-error");
    }

    var saveResult;
    try {
      saveResult = await window.KIMURE_AUTH.saveOnboardingProfile(form, null);
    } catch (err) {
      saveResult = { ok: false };
    }
    if (!saveResult || !saveResult.ok) {
      if (saveResult && saveResult.needsLogin) {
        setAiLoading(false);
        showAiFailure(
          "Please sign in again before generating your recommendation.",
          false
        );
        return;
      }

      // Profile persistence is separate from AI recommendations. A temporary
      // database save problem should not hide a valid Gemini or fallback result.
      console.warn("[kimure:onboarding-ai] profile save unavailable", {
        stage: "onboarding-save"
      });
    }

    var request = buildAiRequest();
    var response;
    try {
      response = await window.KIMURE_AUTH.requestAiRecommendation(
        request.tool,
        request.payload
      );
    } catch (err) {
      response = { ok: false, failureType: "network" };
    }
    setAiLoading(false);

    if (!response || !response.ok) {
      showAiFailure(
        response && response.needsLogin
          ? "Please sign in again before generating your recommendation."
          : "AI recommendations could not be generated right now. Please try again.",
        !(response && response.needsLogin)
      );
      return;
    }

    renderAiRecommendation(response.data, request.tool);
    aiRecommendationComplete = true;
    updateNav();
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
      nextBtn.textContent = aiRecommendationComplete
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
    if (current === 8) {
      if (aiRecommendationComplete) {
        showStep(9);
        return;
      }
      await generateAiRecommendation();
      return;
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

  form.addEventListener("change", function (e) {
    var targetStep = e.target.closest(".onb-form-step");
    var stepNumber = targetStep
      ? parseInt(targetStep.getAttribute("data-step"), 10)
      : 0;
    if (stepNumber >= 2 && stepNumber !== 8) {
      resetAiRecommendation();
    }
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
