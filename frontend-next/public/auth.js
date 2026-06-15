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
      return false;
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
      alert(result.error.message);
      return false;
    }

    window.KIMURE_AUTH_USER_ID = result.data && result.data.user ? result.data.user.id : "";
    alert("Account created. Check Supabase Authentication and the profiles table.");
    return true;
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

  async function saveOnboardingProfile(form, button) {
    var client = getSupabaseClient();
    if (!client) {
      explainMissingConfig();
      return false;
    }

    setButtonLoading(button, true, "Saving...");

    var userResult = await client.auth.getUser();
    var user = userResult.data && userResult.data.user ? userResult.data.user : null;

    if (!user && window.KIMURE_AUTH_USER_ID) {
      user = { id: window.KIMURE_AUTH_USER_ID };
    }

    if (!user) {
      setButtonLoading(button, false);
      alert("Please confirm your email and log in before saving onboarding answers.");
      return false;
    }

    var payload = buildOnboardingPayload(form, user.id);
    var result = await client
      .from("onboarding_profiles")
      .upsert(payload, { onConflict: "user_id" });

    setButtonLoading(button, false);

    if (result.error) {
      alert(result.error.message);
      return false;
    }

    return true;
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
    signUpFromOnboarding: signUpFromOnboarding,
    saveOnboardingProfile: saveOnboardingProfile
  };

  initAuthListener();
})();
