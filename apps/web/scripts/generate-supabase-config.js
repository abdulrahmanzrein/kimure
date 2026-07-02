// Generates apps/web/public/supabase-config.js from environment variables.
// Runs on Vercel at build time. Locally you should have a real
// supabase-config.js committed to your machine (it's gitignored).

const fs = require("fs");
const path = require("path");

const url = process.env.SUPABASE_URL || "";
const anonKey = process.env.SUPABASE_ANON_KEY || "";
const apiBaseUrl = process.env.API_BASE_URL || "";

if (!url || !anonKey || !apiBaseUrl) {
  console.warn("[generate-supabase-config] Missing one or more env vars — writing empty config.");
}

const contents = `window.KIMURE_SUPABASE_CONFIG = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)},
  apiBaseUrl: ${JSON.stringify(apiBaseUrl)}
};
`;

const outPath = path.join(__dirname, "..", "public", "supabase-config.js");
fs.writeFileSync(outPath, contents);
console.log(`[generate-supabase-config] Wrote ${outPath}`);
