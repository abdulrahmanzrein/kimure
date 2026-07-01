(function () {
  "use strict";

  // Tracks the logged-in user in memory. Updated by getCurrentUser, signIn, signOut,
  // and the auth state listener below.
  var currentUser = null;

  function getSupabaseClient() {
    var cfg = window.KIMURE_SUPABASE_CONFIG;
    if (!window.supabase || !cfg || !cfg.url || !cfg.anonKey) return null;
    if (cfg.url.indexOf("YOUR_PROJECT_ID") >= 0 || cfg.anonKey.indexOf("YOUR_SUPABASE") >= 0) return null;
    return window.supabase.createClient(cfg.url, cfg.anonKey);
  }

  // Base URL of our own Kimure backend (NestJS). Set in supabase-config.js;
  // falls back to the local dev server. Onboarding now goes through this API
  // instead of talking to Supabase directly, so the backend can validate + log it.
  function getApiBaseUrl() {
    var cfg = window.KIMURE_SUPABASE_CONFIG;
    if (cfg && cfg.apiBaseUrl) return cfg.apiBaseUrl;
    return "http://localhost:3001/api";
  }

  // Grab the logged-in user's access token (a JWT) from the stored session.
  // The backend reads this from the Authorization header to know who is calling
  // and to enforce row-level security (the user only sees their own row).
  async function getAccessToken() {
    var client = getSupabaseClient();
    if (!client) return null;
    var result = await client.auth.getSession();
    var session = result.data ? result.data.session : null;
    return session ? session.access_token : null;
  }

  var creditAssessmentStorageKey = "kimure.creditAssessmentReference";

  function clearCreditAssessmentReference() {
    try {
      window.sessionStorage.removeItem(creditAssessmentStorageKey);
    } catch (err) {
      // If storage is unavailable, behave like there is no saved reference.
    }
  }

  function normalizeCreditAssessmentReference(reference) {
    if (!reference || typeof reference !== "object") return null;

    var creditAssessmentId = typeof reference.creditAssessmentId === "string"
      ? reference.creditAssessmentId.trim()
      : "";
    var expiresAt = typeof reference.expiresAt === "string"
      ? reference.expiresAt.trim()
      : "";
    var userId = typeof reference.userId === "string"
      ? reference.userId.trim()
      : "";
    var expiresAtMs = Date.parse(expiresAt);

    if (!creditAssessmentId || !expiresAt || !userId || Number.isNaN(expiresAtMs)) return null;
    if (expiresAtMs <= Date.now()) return null;
    if (currentUser && currentUser.id && currentUser.id !== userId) return null;

    return {
      creditAssessmentId: creditAssessmentId,
      expiresAt: expiresAt,
      userId: userId
    };
  }

  function saveCreditAssessmentReference(reference) {
    var normalized = normalizeCreditAssessmentReference(reference);
    if (!normalized) {
      clearCreditAssessmentReference();
      return null;
    }

    try {
      window.sessionStorage.setItem(creditAssessmentStorageKey, JSON.stringify(normalized));
      return normalized;
    } catch (err) {
      return null;
    }
  }

  function getCreditAssessmentReference() {
    var parsed;

    try {
      parsed = JSON.parse(window.sessionStorage.getItem(creditAssessmentStorageKey) || "null");
    } catch (err) {
      clearCreditAssessmentReference();
      return null;
    }

    var normalized = normalizeCreditAssessmentReference(parsed);
    if (!normalized) {
      clearCreditAssessmentReference();
      return null;
    }

    return normalized;
  }

  function explainMissingConfig() {
    alert(
      "Supabase is not configured yet. Copy supabase-config.example.js to supabase-config.js, then add your Supabase Project URL and anon public key."
    );
  }

  function setButtonLoading(button, loading, loadingText) {
    if (!button) return;
    if (loading) {
      button.dataset.originalText = button.textContent;
      button.textContent = loadingText;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  async function signUpFromOnboarding(form, nextButton) {
    var client = getSupabaseClient();
    if (!client) {
      explainMissingConfig();
      return { ok: false, error: { message: "Supabase is not configured." } };
    }

    var email = form.querySelector("#onb-email");
    var password = form.querySelector("#onb-password");
    var fullName = form.querySelector("#onb-fullname");
    var roleInput = form.querySelector('input[name="role"]:checked');
    var emailValue = email ? email.value.trim() : "";
    var passwordValue = password ? password.value : "";
    var roleValue = roleInput ? roleInput.value : "individual";

    setButtonLoading(nextButton, true, "Creating account...");

    var result = await client.auth.signUp({
      email: emailValue,
      password: passwordValue,
      options: {
        data: {
          full_name: fullName && fullName.value ? fullName.value.trim() : ""
        }
      }
    });

    setButtonLoading(nextButton, false);

    if (result.error) {
      return { ok: false, error: result.error };
    }

    var user = result.data && result.data.user ? result.data.user : null;
    var session = result.data && result.data.session ? result.data.session : null;
    var needsEmailConfirmation = !!(user && !session && !user.email_confirmed_at);

    if (user) {
      window.KIMURE_AUTH_USER_ID = user.id;
    }

    if (session && user) {
      currentUser = user;
    }

    // Save the picked role. If we got a session right away (email confirmation
    // off), apply it now. Otherwise stash it in localStorage so it can be
    // applied on first login after the user confirms their email.
    if (roleValue && roleValue !== "individual") {
      try {
        window.localStorage.setItem("kimure.pendingRole", roleValue);
      } catch (err) { /* storage may be unavailable */ }

      if (session && session.access_token) {
        await applyPendingRole(session.access_token);
      }
    }

    return {
      ok: true,
      needsEmailConfirmation: needsEmailConfirmation,
      email: emailValue,
      user: user,
      session: session,
      role: roleValue
    };
  }

  async function resendSignupConfirmation(email) {
    var client = getSupabaseClient();
    if (!client) {
      explainMissingConfig();
      return { error: { message: "Supabase is not configured." } };
    }

    return client.auth.resend({
      type: "signup",
      email: email
    });
  }

  async function requestPasswordReset(email) {
    var client = getSupabaseClient();
    if (!client) {
      explainMissingConfig();
      return { error: { message: "Supabase is not configured." } };
    }

    var redirectTo = window.location.origin + window.location.pathname;

    return client.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo
    });
  }

  function checkedValues(form, name) {
    return Array.prototype.slice.call(form.querySelectorAll('input[name="' + name + '"]:checked')).map(function (input) {
      return input.value;
    });
  }

  function selectedValue(form, name) {
    var input = form.querySelector('input[name="' + name + '"]:checked');
    return input ? input.value : "";
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

  function budgetKeyFromRange(min, max) {
    var minNum = min == null ? null : Number(min);
    var maxNum = max == null ? null : Number(max);
    if (minNum === 0 && maxNum === 50000) return "under50k";
    if (minNum === 50000 && maxNum === 150000) return "50k-150k";
    if (minNum === 150000 && maxNum === 500000) return "150k-500k";
    if (minNum === 500000 && maxNum === 1000000) return "500k-1m";
    if (minNum === 1000000 && maxNum === null) return "1mplus";
    return "";
  }

  function setRadioValue(form, name, value) {
    if (!value) return;
    var input = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (input) input.checked = true;
  }

  function setCheckboxValues(form, name, values) {
    if (!Array.isArray(values)) return;
    values.forEach(function (value) {
      var input = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
      if (input) input.checked = true;
    });
  }

  function applyOnboardingProfileToForm(form, profile) {
    if (!form || !profile) return;

    setRadioValue(form, "goal", profile.intent);
    setRadioValue(form, "budget", budgetKeyFromRange(profile.budget_min, profile.budget_max));
    setRadioValue(form, "timeline", profile.timeline);

    var loc = profile.location_preferences;
    if (Array.isArray(loc) && loc[0]) {
      var country = form.querySelector("#onb-loc-country");
      var city = form.querySelector("#onb-loc-city");
      if (country && loc[0].country) country.value = loc[0].country;
      if (city && loc[0].city) city.value = loc[0].city;
    }

    setCheckboxValues(form, "property_type", profile.property_preferences);

    var fin = profile.financial_inputs || {};
    var funds = form.querySelector("#onb-funds");
    var rental = form.querySelector("#onb-rental-income");
    if (funds && fin.available_funds != null) funds.value = fin.available_funds;
    if (rental && fin.monthly_rental_income != null) rental.value = fin.monthly_rental_income;
    setCheckboxValues(form, "return_goal", fin.return_goals);
  }

  // Load the user's saved onboarding answers from our backend (GET /api/onboarding).
  // No userId argument needed anymore: the backend identifies the user from the token.
  async function fetchOnboardingProfile() {
    var token = await getAccessToken();
    if (!token) return null;

    var response;
    try {
      response = await fetch(getApiBaseUrl() + "/onboarding", {
        headers: { Authorization: "Bearer " + token }
      });
    } catch (err) {
      return null; // server unreachable -> behave like "nothing saved yet"
    }

    // 404 (no row yet) or any error: treat as "no profile saved".
    if (!response.ok) return null;
    return await response.json();
  }

  function numberValue(form, selector) {
    var input = form.querySelector(selector);
    if (!input || input.value === "") return null;
    var n = Number(input.value);
    return Number.isFinite(n) ? n : null;
  }

  function textValue(form, selector) {
    var input = form.querySelector(selector);
    return input && input.value ? input.value.trim() : "";
  }

  function buildOnboardingPayload(form, userId) {
    var budget = budgetRange(selectedValue(form, "budget"));
    var locCountry = textValue(form, "#onb-loc-country");
    var locCity = textValue(form, "#onb-loc-city");

    return {
      user_id: userId,
      intent: selectedValue(form, "goal") || null,
      budget_min: budget[0],
      budget_max: budget[1],
      timeline: selectedValue(form, "timeline") || null,
      risk_level: null,
      location_preferences: locCountry || locCity ? [{ country: locCountry, city: locCity }] : [],
      property_preferences: checkedValues(form, "property_type"),
      financial_inputs: {
        available_funds: numberValue(form, "#onb-funds"),
        monthly_rental_income: numberValue(form, "#onb-rental-income"),
        return_goals: checkedValues(form, "return_goal")
      }
    };
  }

  // Save the user's onboarding answers through our backend (POST /api/onboarding).
  // The backend upserts the row and sets user_id from the token, so we no longer
  // write to Supabase directly here.
  async function saveOnboardingProfile(form, button) {
    setButtonLoading(button, true, "Saving...");

    var token = await getAccessToken();
    if (!token) {
      setButtonLoading(button, false);
      return { ok: false, needsLogin: true, message: "Please confirm your email and sign in before saving onboarding answers." };
    }

    // user_id is included for shape but the backend overrides it from the token.
    var payload = buildOnboardingPayload(form, null);

    var response;
    try {
      response = await fetch(getApiBaseUrl() + "/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      setButtonLoading(button, false);
      return { ok: false, message: "Could not reach the server. Is the API running on " + getApiBaseUrl() + "?" };
    }

    setButtonLoading(button, false);

    if (!response.ok) {
      var errBody = await response.json().catch(function () { return {}; });
      return { ok: false, message: errBody.message || "Saving failed." };
    }

    return { ok: true };
  }

  // Send the official credit-profile contract to the Kimure API. Website code
  // never calls Gemini, a bureau provider, or the AI Gateway directly.
  async function requestCreditProfile(payload) {
    var token = await getAccessToken();
    if (!token) {
      return {
        ok: false,
        needsLogin: true,
        message: "Please sign in before requesting a credit-readiness assessment."
      };
    }

    var response;
    try {
      response = await fetch(getApiBaseUrl() + "/ai/credit-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      return {
        ok: false,
        message: "Could not reach the Kimure API. Confirm the local API is running."
      };
    }

    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var message = typeof body.message === "string"
        ? body.message
        : "The credit-readiness request could not be completed.";
      return { ok: false, message: message };
    }

    return { ok: true, data: body };
  }

  // Send mortgage details to the Kimure API only. The browser may attach an
  // opaque creditAssessmentId, but never raw credit handoff/provider data.
  async function requestMortgage(payload) {
    var token = await getAccessToken();
    if (!token) {
      return {
        ok: false,
        needsLogin: true,
        message: "Please sign in before requesting a mortgage estimate."
      };
    }

    var safePayload = { ...(payload || {}) };
    delete safePayload.creditMortgageHandoff;
    delete safePayload.creditProfileContext;
    delete safePayload.credit_profile_context;

    var response;
    try {
      response = await fetch(getApiBaseUrl() + "/ai/mortgage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(safePayload)
      });
    } catch (err) {
      return {
        ok: false,
        message: "Could not reach the Kimure API. Confirm the local API is running."
      };
    }

    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var message = typeof body.message === "string"
        ? body.message
        : "The mortgage estimate could not be completed.";
      return { ok: false, message: message };
    }

    return { ok: true, data: body };
  }

  // Generic authenticated Kimure AI request helper. Frontend flows call our
  // NestJS API only; the API owns AI Gateway forwarding and provider boundaries.
  async function requestAiTool(tool, payload) {
    var safeTool = String(tool || "").trim();
    if (!/^[a-z0-9-]+$/i.test(safeTool)) {
      return { ok: false, message: "AI tool could not be selected." };
    }

    var token = await getAccessToken();
    if (!token) {
      return {
        ok: false,
        needsLogin: true,
        message: "Please sign in before requesting AI recommendations."
      };
    }

    var response;
    try {
      response = await fetch(getApiBaseUrl() + "/ai/" + safeTool, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(payload || {})
      });
    } catch (err) {
      return {
        ok: false,
        message: "AI recommendations could not be generated right now. Please try again."
      };
    }

    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var message = typeof body.message === "string"
        ? body.message
        : "AI recommendations could not be generated right now. Please try again.";
      return { ok: false, message: message };
    }

    return { ok: true, data: body };
  }

  // Read dashboard-safe AI, credit, mortgage, and financial profile summaries
  // from the Kimure API. The dashboard never reads raw Supabase credit tables
  // or talks to the AI Gateway directly.
  async function fetchDashboardAiCredit() {
    var token = await getAccessToken();
    if (!token) {
      return {
        ok: false,
        needsLogin: true,
        message: "Please sign in to view your dashboard."
      };
    }

    var response;
    try {
      response = await fetch(getApiBaseUrl() + "/dashboard/ai-credit", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token
        }
      });
    } catch (err) {
      return {
        ok: false,
        message: "Could not reach the Kimure API. Confirm the local API is running."
      };
    }

    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var message = typeof body.message === "string"
        ? body.message
        : "Dashboard data could not be loaded.";
      return { ok: false, message: message };
    }

    return { ok: true, data: body };
  }

  // Read safe backend-only credit provider readiness metadata. This endpoint
  // does not call Equifax, request tokens, or return secrets/raw bureau data.
  async function fetchCreditProviderStatus() {
    var response;
    try {
      response = await fetch(getApiBaseUrl() + "/credit/provider-status", {
        method: "GET"
      });
    } catch (err) {
      return {
        ok: false,
        message: "Could not reach the Kimure API. Confirm the local API is running."
      };
    }

    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var message = typeof body.message === "string"
        ? body.message
        : "Provider readiness could not be loaded.";
      return { ok: false, message: message };
    }

    return { ok: true, data: body };
  }

  // Run the protected backend-only Equifax sandbox verification route. The
  // browser sends only the sandbox verification flags; provider credentials,
  // request construction, and any provider call remain server-side.
  async function requestCreditProviderSandboxVerification() {
    var token = await getAccessToken();
    if (!token) {
      return {
        ok: false,
        needsLogin: true,
        message: "Please sign in to run sandbox provider verification."
      };
    }

    var payload = {
      consent: true,
      permissiblePurposeCode: "57",
      sandboxIdentity: true
    };

    var response;
    try {
      response = await fetch(getApiBaseUrl() + "/credit/provider-sandbox-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      return {
        ok: false,
        message: "Could not reach the Kimure API. Confirm the local API is running."
      };
    }

    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var message = typeof body.message === "string"
        ? body.message
        : "Sandbox provider verification could not be completed.";
      return { ok: false, message: message, data: body };
    }

    return { ok: true, data: body };
  }

  // Ask Supabase who is logged in right now.
  // Supabase checks the stored session token in the browser (localStorage).
  async function getCurrentUser() {
    var client = getSupabaseClient();
    if (!client) return null;

    var result = await client.auth.getUser();
    if (result.error) {
      currentUser = null;
      return null;
    }

    currentUser = result.data.user;
    return currentUser;
  }

  // Log in an existing user with email + password.
  // Reads the picked role from localStorage (set during signup) and PATCHes
  // the user's profile. Clears storage on success. Safe to call multiple times.
  async function applyPendingRole(accessToken) {
    var pending;
    try {
      pending = window.localStorage.getItem("kimure.pendingRole");
    } catch (err) {
      pending = null;
    }
    if (!pending) return;

    try {
      var res = await fetch(getApiBaseUrl() + "/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + accessToken
        },
        body: JSON.stringify({ role: pending })
      });
      if (res.ok) {
        try { window.localStorage.removeItem("kimure.pendingRole"); } catch (e) {}
      }
    } catch (err) {
      // Non-fatal — will retry on next login.
    }
  }

  async function signIn(email, password) {
    var client = getSupabaseClient();
    if (!client) {
      explainMissingConfig();
      return { user: null, error: { message: "Supabase is not configured." } };
    }

    var result = await client.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (!result.error) {
      currentUser = result.data.user;
    }

    return result;
  }

  // End the session and clear the stored token.
  async function signOut() {
    var client = getSupabaseClient();
    if (!client) {
      explainMissingConfig();
      return { error: { message: "Supabase is not configured." } };
    }

    var result = await client.auth.signOut();
    currentUser = null;
    clearCreditAssessmentReference();
    return result;
  }

  // Listen for auth changes: login, logout, token refresh, page reload with existing session.
  // Fires a custom event so other scripts (like script.js) can update the UI.
  function initAuthListener() {
    var client = getSupabaseClient();
    if (!client) return;

    client.auth.onAuthStateChange(function (event, session) {
      currentUser = session && session.user ? session.user : null;
      if (!currentUser || event === "SIGNED_OUT") {
        clearCreditAssessmentReference();
      } else {
        getCreditAssessmentReference();
        // If a role was picked at signup but couldn't be applied (email
        // confirmation on), apply it now that we have a valid session.
        if (event === "SIGNED_IN" && session && session.access_token) {
          applyPendingRole(session.access_token);
        }
      }
      document.dispatchEvent(
        new CustomEvent("kimure-auth-changed", {
          detail: { event: event, user: currentUser }
        })
      );
    });

    getCurrentUser();
  }

  window.KIMURE_AUTH = {
    getSupabaseClient: getSupabaseClient,
    getCurrentUser: getCurrentUser,
    signIn: signIn,
    signOut: signOut,
    initAuthListener: initAuthListener,
    resendSignupConfirmation: resendSignupConfirmation,
    requestPasswordReset: requestPasswordReset,
    fetchOnboardingProfile: fetchOnboardingProfile,
    applyOnboardingProfileToForm: applyOnboardingProfileToForm,
    signUpFromOnboarding: signUpFromOnboarding,
    saveOnboardingProfile: saveOnboardingProfile,
    requestCreditProfile: requestCreditProfile,
    requestMortgage: requestMortgage,
    requestAiTool: requestAiTool,
    fetchDashboardAiCredit: fetchDashboardAiCredit,
    fetchCreditProviderStatus: fetchCreditProviderStatus,
    requestCreditProviderSandboxVerification: requestCreditProviderSandboxVerification,
    saveCreditAssessmentReference: saveCreditAssessmentReference,
    getCreditAssessmentReference: getCreditAssessmentReference,
    clearCreditAssessmentReference: clearCreditAssessmentReference
  };

  initAuthListener();
})();
