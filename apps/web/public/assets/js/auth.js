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
    var emailValue = email ? email.value.trim() : "";
    var passwordValue = password ? password.value : "";

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

    return {
      ok: true,
      needsEmailConfirmation: needsEmailConfirmation,
      email: emailValue,
      user: user,
      session: session
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
    return result;
  }

  // Listen for auth changes: login, logout, token refresh, page reload with existing session.
  // Fires a custom event so other scripts (like script.js) can update the UI.
  function initAuthListener() {
    var client = getSupabaseClient();
    if (!client) return;

    client.auth.onAuthStateChange(function (event, session) {
      currentUser = session && session.user ? session.user : null;
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
    requestCreditProfile: requestCreditProfile
  };

  initAuthListener();
})();
