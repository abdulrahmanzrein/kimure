(function () {
  "use strict";

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

  window.KIMURE_AUTH = {
    signUpFromOnboarding: signUpFromOnboarding
  };
})();

