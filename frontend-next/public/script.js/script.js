// Footer year (works on all pages + section footers)
const yearNow = new Date().getFullYear();
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = yearNow;
document.querySelectorAll(".js-footer-year").forEach(function (el) {
  el.textContent = yearNow;
});

// Watch Demo: open video in modal on same page
(function () {
  var demoUrl = "https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Freel%2F672058439261697";
  var overlay = document.getElementById("demoOverlay");
  var iframe = document.querySelector(".demo-iframe");
  var triggers = document.querySelectorAll(".js-watch-demo");
  var closeBtn = document.getElementById("demoClose");

  function openDemo() {
    if (!overlay) return;
    if (iframe) iframe.src = demoUrl;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeDemo() {
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (iframe) iframe.src = "";
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener("click", function (e) { e.preventDefault(); openDemo(); });
  });
  if (closeBtn) closeBtn.addEventListener("click", closeDemo);
  if (overlay) overlay.addEventListener("click", function (e) { if (e.target === overlay) closeDemo(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay && overlay.classList.contains("is-open")) closeDemo();
  });
})();

// Language + theme (pages with data-i18n / lang toggle get full home copy in FR)
const I18N = {
  en: {
    "titles.home": "Kimure Home",
    "titles.about": "About Kimure",
    "titles.platform": "Kimure Platform",
    "titles.solutions": "Kimure Solutions",
    "titles.marketplace": "Kimure Marketplace",
    "titles.investors": "Kimure Investors",
    "titles.onboarding": "Kimure — Onboarding",
    "titles.onboardingForm": "Smart Onboarding — Kimure",
    "titles.legal": "Legal & Compliance — Kimure",
    "nav.legal": "Legal & Compliance",
    "legal.backHome": "← Back to home",
    "legal.backHomeShort": "Home",
    "legal.heroTagline": "AI Brokerage Platform",
    "legal.tocTitle": "On this page",
    themeDark: "Dark",
    themeLight: "Light",
    "aria.nav": "Primary Navigation",
    "aria.langToggle": "Switch language",
    "aria.themeToggle": "Toggle dark/light mode",
    "aria.roadmap": "Rollout roadmap",
    "aria.mock": "Kimure Preview Dashboard",
    "aria.heroVideo": "Kimure introduction video",
    "aria.marketplaceSearch": "Marketplace teaser search",
    "aria.featuredListings": "Featured listings",
    "aria.searchListings": "Search listings",
    "aria.mpValue": "What Kimure delivers",
    "aria.mpBrowseCategories": "Marketplace categories",
    "aria.mpBrowseModes": "Choose listing intent",
    "aria.mpSubBuy": "Property types for buyers",
    "aria.mpSubSale": "Property types for sellers",
    "aria.mpSubRent": "Property types for rent",
    "aria.mpSubInvest": "Property types for investors",
    "aria.mpCatalogGrid": "Listings matching your filters",
    "aria.mpIntentBuy": "Buy listings",
    "aria.mpIntentSale": "For sale listings",
    "aria.mpIntentRent": "Rent listings",
    "aria.mpIntentInvest": "Invest listings",
    "aria.solutionsByIndustry": "Solutions by industry",
    "aria.solutionsByUseCase": "Solutions by use case",
    "aria.solutionsForTeams": "Solutions for teams",
    "mp.noResults": "No listings match your search. Try a different location, property type, or ROI.",
    "aria.social": "Social links",
    "img.logoAlt": "Kimure logo",
    "nav.about": "About",
    "nav.story": "Our Story",
    "nav.mission": "Mission & Vision",
    "nav.team": "Team",
    "nav.careers": "Careers",
    "nav.press": "Press / Media",
    "nav.contact": "Contact Us",
    "nav.platform": "Platform",
    "nav.overview": "Overview",
    "nav.features": "Features",
    "nav.how": "How It Works",
    "nav.mobileSoon": "Mobile app — coming soon",
    "nav.solutions": "Solutions",
    "nav.byIndustry": "By industry",
    "nav.realestate": "Real Estate",
    "nav.finance": "Finance",
    "nav.education": "Education",
    "nav.byUseCase": "By use case",
    "nav.dataAnalysis": "Data Analysis",
    "nav.automation": "Automation",
    "nav.aiInsights": "AI Insights",
    "nav.forTeams": "For teams",
    "nav.startups": "Startups",
    "nav.enterprises": "Enterprises",
    "nav.marketplace": "Marketplace",
    "nav.browseListings": "Browse listings",
    "nav.allListings": "All listings",
    "nav.categories": "Categories",
    "nav.featured": "Featured",
    "nav.newArrivals": "New Arrivals",
    "nav.topRated": "Top Rated",
    "nav.sellItem": "Sell / List Your Item",
    "nav.investors": "Investors",
    "nav.invOverview": "Overview",
    "nav.financials": "Financials",
    "nav.reports": "Reports",
    "nav.pitchDeck": "Pitch Deck",
    "nav.news": "News / Updates",
    "nav.governance": "Governance",
    "nav.onboarding": "Onboarding",
    "nav.earlyAccess": "Login / Sign up",
    "nav.signOut": "Sign out",
    "hero.title": "The Future of Real Estate, Land & Agriculture — Powered by AI",
    "hero.sub": "Kimure is the world's first unified AI brokerage platform for real estate, rural land, agricultural assets, and financial services. Buy, sell, rent, invest, and finance — intelligently.",
    "hero.explore": "Explore the Platform",
    "hero.startFree": "Get Started Free",
    "hero.bookDemo": "Book a Demo",
    "hero.phase": "Phase",
    "hero.phaseVal": "Canada → US → Global",
    "hero.core": "Core",
    "hero.coreVal": "Matching • Inspection • Finance",
    "hero.trust": "Trust",
    "hero.trustVal": "Verified + secure workflows",
    "roadmap.label": "Rollout",
    "roadmap.canada": "Canada",
    "roadmap.us": "US",
    "roadmap.global": "Global",
    "mock.title": "Live Intelligence Panel",
    "mock.chip": "Market Signals",
    "mock.valuation": "AI Property Valuation",
    "mock.estimated": "Estimated",
    "mock.confidence": "Confidence",
    "mock.high": "High",
    "mock.investMatch": "Investment Match",
    "mock.fitScore": "Fit Score",
    "mock.roi": "ROI Projection",
    "mock.strong": "Strong",
    "mock.mortgage": "Mortgage Pre-Approval",
    "mock.eligible": "Eligible",
    "mock.in24h": "in 24 hrs",
    "mock.options": "Options",
    "mock.compareLenders": "Compare lenders",
    "mock.riskFlags": "Risk Flags",
    "mock.low": "Low",
    "trust.title": "AI Features built for trust, speed, and clarity",
    "trust.f1t": "AI Inspection",
    "trust.f1p": "Standardized due diligence from photos, video, and satellite signals.",
    "trust.f2t": "Smart Matching",
    "trust.f2p": "Intent-based matching across buyers, sellers, investors, and institutions.",
    "trust.f3t": "Financial Simulation",
    "trust.f3p": "Affordability + ROI projections with lender and investor pathways.",
    "trust.f4t": "Secure Transactions",
    "trust.f4p": "Verified listings, documents, e-sign, compliance checks, tracking.",
    "tile1t": "AI Brokerage Engine",
    "tile1p": "Qualification, matchmaking, recommendations, and advisory intelligence.",
    "tile2t": "Smart Inspections",
    "tile2p": "Repair estimation, compliance gaps, and value enhancement opportunities.",
    "tile3t": "Financial Brokerage Layer",
    "tile3p": "Mortgages, agricultural credit, insurance, and lender/investor connections.",
    "tile4t": "Transaction Hub",
    "tile4p": "Documents, e-signatures, regulatory workflows, and secure closing.",
    "mp.title": "Marketplace Intelligence",
    "mp.sub": "Buy, sell, lease, and invest in verified real estate, rural land, and agricultural assets with AI-guided navigation.",
    "mp.placeholder": "Search by location, ROI, or property type",
    "mp.search": "Search",
    "mp.explore": "Explore Marketplace",
    "mp.verified": "Verified",
    "mp.viewDetails": "View Details →",
    "mp.listing1": "Urban • 3 Bed • Canada",
    "mp.listing2": "Rural Land • 48 Acres",
    "mp.listing3": "Agricultural • Lease Option",
    "mp.p1t": "Verified Listings Only",
    "mp.p1p": "Identity checks, document validation, and fraud prevention.",
    "mp.p2t": "AI-Powered Search & Match",
    "mp.p2p": "Discovery based on goals, budget, intent signals, and risk appetite.",
    "mp.p3t": "Secure Contracts & Workflows",
    "mp.p3p": "E-signatures, compliance checks, and transaction tracking.",
    "mp.p4t": "Lender & Investor Network",
    "mp.p4p": "Pre-qualification, affordability, ROI projections, approvals.",
    "mp.catTitle": "Buy, sell, rent, and invest",
    "mp.catLead": "The same listing cards as featured above, grouped by how you want to participate. Use search to filter every section.",
    "mp.intentEmpty": "No listings match your search in this section.",
    "mp.modeBuy": "Buy",
    "mp.modeSale": "For sale",
    "mp.modeRent": "Rent",
    "mp.modeInvest": "Invest",
    "mp.cat.all": "All types",
    "mp.cat.urbanFarm": "Urban farms",
    "mp.cat.apartment": "Apartments & condos",
    "mp.cat.rural": "Rural homes & land",
    "mp.cat.commercial": "Commercial",
    "mp.cat.agricultural": "Agricultural land",
    "mp.cat.landLot": "Lots & development sites",
    "mp.cat.house": "Houses & single-family",
    "mp.cat.sellUrbanFarm": "Urban farms & agri parcels",
    "mp.cat.sellApartment": "Apartments & condos",
    "mp.cat.sellRural": "Rural property & acreage",
    "mp.cat.sellHouse": "Single-family homes",
    "mp.cat.sellCommercial": "Commercial buildings",
    "mp.cat.sellAg": "Farmland & agricultural",
    "mp.cat.sellLandLot": "Vacant land & lots",
    "mp.cat.rentApt": "Apartments & condos",
    "mp.cat.rentHouse": "Houses",
    "mp.cat.rentUrbanFarm": "Urban farms & micro-farms",
    "mp.cat.rentCommercial": "Commercial & retail",
    "mp.cat.rentFarmland": "Farmland lease",
    "mp.cat.rentShort": "Short-term & flexible",
    "mp.cat.invRural": "Rural land & acreage",
    "mp.cat.invUrbanFarm": "Urban farms & ag assets",
    "mp.cat.invCommercial": "Commercial income",
    "mp.cat.invMultifamily": "Multifamily & condos",
    "mp.cat.invSf": "Built-to-rent & single-family portfolios",
    "mp.cat.invDev": "Development & pre-construction",
    "mp.cat.invSynd": "Syndications & funds",
    "vision.label": "Vision",
    "vision.title": "Building the world’s first AI Brokerage Infrastructure",
    "vision.text": "Kimure transforms fragmented markets into a unified, intelligent, and secure transaction ecosystem powered by AI, real-time data, geospatial intelligence, and financial decision tools.",
    "vision.requestDeck": "Request Investor Deck",
    "vision.exploreCases": "Explore Use Cases",
    "footer.rights": "Kimure powered by Kimuntu Power Inc. All Rights Reserved.",
    "footer.powered": "AI Brokerage Platform for Real Estate, Rural Land & Financial Services.",
    "footer.colPlatform": "Platform",
    "footer.colSolutions": "Solutions",
    "footer.colResources": "Resources",
    "footer.colCompany": "Company",
    "footer.link.marketplace": "Marketplace",
    "footer.link.buyerHub": "Buyer Hub",
    "footer.link.sellerHub": "Seller Hub",
    "footer.link.rentalHub": "Rental Hub",
    "footer.link.landRural": "Land & Rural",
    "footer.link.agriAssets": "Agri Assets",
    "footer.link.financing": "Financing",
    "footer.link.aiSim": "AI Simulation",
    "footer.link.inspector": "Inspector AI",
    "footer.link.buy": "Buy Real Estate",
    "footer.link.sell": "Sell Real Estate",
    "footer.link.rent": "Rent a Property",
    "footer.link.leaseAgri": "Lease Agricultural Land",
    "footer.link.invest": "Investment Opportunities",
    "footer.link.valuation": "Property Valuation",
    "footer.link.mortgage": "Loan & Mortgage",
    "footer.link.insurance": "Insurance Brokerage",
    "footer.link.matching": "Smart Matching",
    "footer.link.landAnalytics": "Land & Soil Analytics",
    "footer.link.ruralFinance": "Rural Dev & Agri-Finance",
    "footer.link.building": "Building Projects",
    "footer.link.blog": "Blog & Insights",
    "footer.link.trends": "Market Trends",
    "footer.link.pricing": "Pricing",
    "footer.link.docs": "Documentation & Guides",
    "footer.link.faq": "FAQs",
    "footer.link.community": "Community & Forum",
    "footer.link.api": "Developer API",
    "footer.link.about": "About Us",
    "footer.link.careers": "Careers",
    "footer.link.partners": "Partnerships",
    "footer.link.press": "Press & Media",
    "footer.link.contact": "Contact / Help Center",
    "footer.legal.terms": "Terms of Service",
    "footer.legal.privacy": "Privacy Policy",
    "footer.legal.cookies": "Cookie Policy",
    "footer.legal.data": "Data Protection",
    "footer.legal.verify": "User Verification",
    "footer.legal.antifraud": "Anti-Fraud & Compliance",
    "footer.legal.fairhousing": "Fair Housing",
    "footer.legal.broker": "Brokerage Licensing",
    "home.badge1": "AI-Powered Intelligence",
    "home.badge2": "Blockchain-Verified Transactions",
    "home.badge3": "PIPEDA · GDPR · CASL Compliant",
    "home.badge4": "Serving Buyers, Sellers, Investors, Farmers & Professionals",
    "home.whatH": "What is Kimure?",
    "home.whatP": "Kimure is an AI-powered brokerage ecosystem that brings together everything you need to navigate property, land, and financial decisions in one place. Whether you are a first-time homebuyer, a seasoned investor, a farmer looking for productive land, or a real estate professional seeking smarter tools — Kimure was built for you.",
    "home.whatImgAlt": "Contemporary home at dusk — luxury residential real estate",
    "home.pillarsH": "Core Platform Pillars",
    "home.p1t": "Real Estate Brokerage",
    "home.p1d": "Buy, sell, and rent residential, commercial, and investment properties with AI guidance.",
    "home.p2t": "Rural Land Intelligence",
    "home.p2d": "Discover and evaluate agricultural and rural land with soil analytics and yield forecasting.",
    "home.p3t": "Agricultural Assets",
    "home.p3d": "Assess farm infrastructure, crop potential, and agri-finance options.",
    "home.p4t": "Financial Brokerage",
    "home.p4d": "Mortgage simulation, loan pre-qualification, and insurance matching.",
    "home.p5t": "AI Inspection & Valuation",
    "home.p5d": "Inspector AI delivers instant property condition reports and valuations.",
    "home.p6t": "CRM & Growth Engine",
    "home.p6d": "AI-powered lead management, audience targeting, and marketing automation.",
    "home.howH": "How It Works",
    "home.step1l": "Discover",
    "home.step1p": "Search verified listings across real estate, rural land, and agricultural assets using AI-powered filters.",
    "home.step2l": "Match",
    "home.step2p": "Kimure's AI analyses your profile, behaviour, and financial capacity to recommend the best-fit opportunities.",
    "home.step3l": "Transact",
    "home.step3p": "Complete secure, blockchain-audited transactions with e-signatures, compliance checks, and financial tools — all in one place.",
    "home.whoH": "Who Kimure Serves",
    "home.whoColRole": "User type",
    "home.whoColHelp": "How Kimure helps",
    "home.who1r": "First-Time Homebuyers",
    "home.who1h": "AI guidance, affordability simulation, mortgage pre-qualification.",
    "home.who2r": "Property Investors",
    "home.who2h": "ROI forecasting, portfolio dashboards, risk intelligence.",
    "home.who3r": "Real Estate Agents",
    "home.who3h": "Full CRM, lead scoring, AI marketing automation, MLS integration.",
    "home.who4r": "Farmers & Landowners",
    "home.who4h": "Soil analytics, crop yield forecasting, agri-finance access.",
    "home.who5r": "Landlords & Property Managers",
    "home.who5h": "Tenant screening, rental hub, e-signature contracts.",
    "home.who6r": "Mortgage Seekers",
    "home.who6h": "Lender comparison, pre-qualification, rate simulation.",
    "home.who7r": "Developers & Builders",
    "home.who7h": "Building project listings, construction finance, pre-sale management.",
    "home.who8r": "Agricultural Investors",
    "home.who8h": "Land intelligence, agri-REIT tools, investment analytics.",
    "home.testH": "Testimonials",
    "home.test1q": "\"Kimure found me productive farmland I never would have found on my own. The soil report was incredibly detailed.\"",
    "home.test1m": "— Marie T., Agricultural Investor, Ontario",
    "home.test2q": "\"From pre-qualification to closing, the platform kept every step organized. The AI matching saved weeks of searching.\"",
    "home.test2m": "— Jordan K., First-Time Buyer",
    "home.test3q": "\"Our team finally has one CRM that ties listings, leads, and compliance together without juggling five tools.\"",
    "home.test3m": "— Samira R., Brokerage Lead",
    "home.blogH": "Latest from the Blog",
    "home.blog1t": "Canadian Housing Trends Q1: What Buyers Should Watch",
    "home.blog1c": "Market Trends",
    "home.blog1d": "Mar 12, 2026",
    "home.blog2t": "Soil Health 101: Reading a Kimure Land Intelligence Report",
    "home.blog2c": "Agricultural Intelligence",
    "home.blog2d": "Mar 5, 2026",
    "home.blog3t": "Financing Pre-Sales: A Developer’s Checklist",
    "home.blog3c": "Building Projects",
    "home.blogRead": "Read more",
    "home.partnersH": "Partners & Trusted By",
    "home.partnersP": "Lender partners, real estate board affiliations, technology partners, and regulatory bodies.",
    "home.footerCtaH": "Ready to Transform Your Property Journey?",
    "home.footerCtaSub": "Join thousands of buyers, sellers, investors, and professionals already using Kimure.",
    "home.footerCta1": "Login / Sign up",
    "home.footerCta2": "Book a Demo",
    "home.footerCta3": "Talk to an Expert",
    "social.facebook": "Facebook",
    "social.linkedin": "LinkedIn",
    "social.email": "Email",
    "demo.dialogAria": "Watch demo video",
    "demo.closeAria": "Close",
    "demo.iframeTitle": "Kimure demo video",
    "demo.fallbackBefore": "Can’t see the video?",
    "demo.fallbackLink": "Watch on Facebook",
    "earlyAccess.placeholder": "you@example.com",
    "earlyAccess.closeBtn": "Close",
    "auth.title": "Log in or sign up",
    "auth.sub": "Access your Kimure account or continue to smart registration.",
    "auth.tabLogin": "Login",
    "auth.tabSignUp": "Sign up",
    "auth.emailLabel": "Email",
    "auth.passwordLabel": "Password",
    "auth.passwordPlaceholder": "Enter your password",
    "auth.loginSubmit": "Log in",
    "auth.loginErrorInvalid": "Wrong email or password. Please try again.",
    "auth.loginErrorEmailConfirm": "Please confirm your email before logging in.",
    "auth.loginErrorGeneric": "Could not log in. Please try again.",
    "auth.signUpIntro": "Create your account with our Smart Onboarding form: email access link, password, profile, goals, and AI matching.",
    "auth.signUpContinue": "Continue to registration",
    "auth.signUpNote": "You’ll verify your email, set your password, and complete steps 1–10.",
    "auth.loginSuccess": "You’re signed in.",
    "auth.forgotPassword": "Forgot password?",
    "auth.resetTitle": "Reset your password",
    "auth.resetSub": "Enter your email and we’ll send you a reset link.",
    "auth.resetSubmit": "Send reset link",
    "auth.resetBack": "Back to login",
    "auth.resetSuccess": "Password reset email sent. Check your inbox.",
    "auth.resetErrorGeneric": "Could not send reset email. Please try again.",

    "ab.tag": "About Kimure",
    "ab.title": "The AI Brokerage Layer for Real Estate, Land, and Finance",
    "ab.sub": "Kimure is building trusted AI infrastructure that helps buyers, sellers, investors, and institutions discover, verify, value, and transact with speed, clarity, and security.",
    "ab.reqAccess": "Request Early Access",
    "ab.explore": "Explore Platform",
    "ab.missionH": "Our Mission",
    "ab.missionP": "Make real estate and land transactions smarter and safer by combining verification, AI-driven insights, and finance tooling into one brokerage-grade workflow.",
    "ab.whyH": "Why Kimure",
    "ab.whyP": "These markets are fragmented. Data is inconsistent. Trust is expensive. Kimure brings structure to discovery, due diligence, and deal execution so decisions become faster and more reliable.",
    "ab.buildH": "What We Build",
    "ab.v1h": "Verification and Trust",
    "ab.v1p": "Verified listings, document validation, identity checks, and compliance workflows.",
    "ab.v2h": "AI Valuation and Intelligence",
    "ab.v2p": "Pricing, confidence scoring, market signals, geospatial context, and investment scenarios.",
    "ab.v3h": "Matching and Deal Routing",
    "ab.v3p": "Intent-based matching across buyers, sellers, investors, lenders, and institutions.",
    "ab.v4h": "Finance Layer",
    "ab.v4p": "Affordability checks, lender comparisons, mortgage pathways, and ROI projections.",
    "ab.forH": "Who It’s For",
    "ab.f1h": "Buyers and Sellers",
    "ab.f1p": "Find verified opportunities, reduce risk, and move through transactions with confidence.",
    "ab.f2h": "Investors",
    "ab.f2p": "Compare deals using AI insights, financial projections, and trust signals.",
    "ab.f3h": "Lenders and Institutions",
    "ab.f3p": "Standardize inputs, streamline decisioning, and improve underwriting visibility.",
    "ab.f4h": "Brokers and Operators",
    "ab.f4p": "Upgrade workflows with smart due diligence, faster matching, and compliant deal execution.",
    "ab.howH": "How It Works",
    "ab.step1": "Discover verified listings with AI-guided search.",
    "ab.step2": "Validate identity, documents, and risk signals.",
    "ab.step3": "Value with AI valuation, comparables, and market signals.",
    "ab.step4": "Transact through secure workflows, e-sign, and tracked milestones.",
    "ab.step5": "Finance with lender pathways and investment scenarios.",
    "ab.discover": "Discover",
    "ab.validate": "Validate",
    "ab.value": "Value",
    "ab.transact": "Transact",
    "ab.finance": "Finance",
    "ab.trustDesignH": "Trust by Design",
    "ab.trust1": "Verified listings and standardized due diligence",
    "ab.trust2": "Audit-friendly workflows and clear transaction tracking",
    "ab.trust3": "Security-first data handling and role-based access patterns",
    "ab.trust4": "Compliance checks and document integrity signals",
    "ab.teamH": "Team",
    "ab.teamP": "Kimure is built by a team focused on real estate, AI, land markets, and secure financial infrastructure.",
    "ab.careersH": "Careers",
    "ab.careersP": "We’re growing. Interested in joining Kimure? Reach out through Contact Us with your background and interests.",
    "ab.pressH": "Press / Media",
    "ab.pressP": "For press inquiries, interviews, and media assets, please contact us through the channel below.",
    "ab.contactH": "Contact us",
    "ab.contactLead": "Questions, demos, and partnerships — we’re here to help.",
    "ab.contactEmailLabel": "Support email",
    "ab.contactLinkedInLabel": "LinkedIn",
    "ab.contactLinkedInValue": "Company page",
    "ab.finalH": "Build with Kimure",
    "ab.finalP": "If you’re an investor, partner, or early user, we’d love to share the roadmap and get your feedback.",
    "ab.finalDeck": "Request Investor Deck",
    "ab.finalHome": "Back to Home",

    "pl.tag": "Platform",
    "pl.title": "The AI Brokerage Platform for Real Estate, Land & Finance",
    "pl.sub": "One unified platform: qualification and matchmaking, AI inspection and valuation, financial brokerage, and secure transaction closing—built for buyers, sellers, investors, lenders, and operators.",
    "pl.exploreMp": "Explore Marketplace",
    "pl.trustTitle": "Core platform modules",
    "pl.f1t": "AI Brokerage Engine",
    "pl.f1p": "Qualification, matchmaking, recommendations, and advisory intelligence across property, land, and finance.",
    "pl.f2t": "Smart Inspections",
    "pl.f2p": "Repair estimation, compliance gaps, value enhancement opportunities, and inspection workflows from photos and data.",
    "pl.f3t": "Financial Brokerage Layer",
    "pl.f3p": "Mortgages, agricultural credit, insurance, and direct connections to lenders and investors.",
    "pl.f4t": "Transaction Hub",
    "pl.f4p": "Documents, e-signatures, regulatory workflows, and secure closing with full audit trails.",
    "pl.tile1t": "Discovery & matching",
    "pl.tile1p": "Intent-based discovery, verified listings, and AI-driven matching between buyers, sellers, investors, and institutions.",
    "pl.tile2t": "Valuation & intelligence",
    "pl.tile2p": "Market valuation, ROI projections, risk signals, and geospatial context—all in one place for faster decisions.",
    "pl.tile3t": "Finance & lending",
    "pl.tile3p": "Pre-qualification, affordability checks, lender comparison, and agricultural credit pathways built into the flow.",
    "pl.tile4t": "Closing & compliance",
    "pl.tile4p": "Document management, e-sign, regulatory checks, and partner integrations with lawyers, notaries, and authorities.",
    "pl.visionLbl": "Built for scale",
    "pl.visionTitle": "One platform, every step of the deal",
    "pl.visionText": "From first search to closing, Kimure brings inspection, valuation, matching, finance, and compliance into a single brokerage-grade workflow—so every party moves faster with more clarity and trust.",
    "pl.visionMp": "Explore Marketplace",

    "sol.heroTag": "Solutions",
    "sol.heroTitle": "Solutions for Real Estate, Rural Land, Agricultural Assets & Financial Services",
    "sol.heroSub": "Kimure delivers an AI brokerage layer that standardizes inspection, matching, valuation, finance, and closing across fragmented property and land markets.",
    "sol.heroImgAlt": "Vision of home and property in your hand — innovation and possibility",
    "sol.capTitle": "AI capabilities built into every Kimure solution",
    "sol.c1t": "AI Inspection & Due Diligence",
    "sol.c1p": "Photos, video, and satellite signals to assess condition, repairs, compliance, and upside.",
    "sol.c2t": "Smart Matching & Marketplace Routing",
    "sol.c2p": "Intent-based matching across buyers, sellers, investors, lenders, and operators.",
    "sol.c3t": "Valuation, Pricing & Negotiation",
    "sol.c3p": "Market valuation, negotiation scenarios, risk outlook, and ROI simulations.",
    "sol.c4t": "Secure Transactions & Closing",
    "sol.c4p": "Verified listings, document workflows, e-signatures, and compliance tracking.",
    "sol.g1t": "For Buyers & Sellers",
    "sol.g1p": "Discovery, verification, valuation, and financing paths for urban real estate and rural assets in one flow.",
    "sol.g2t": "For Investors & Funds",
    "sol.g2p": "Portfolio-ready analytics, ROI projections, scenario testing, and deal routing across geographies.",
    "sol.g3t": "For Lenders & Insurers",
    "sol.g3p": "Standardized inputs, inspection intelligence, and risk scoring to support credit and coverage decisions.",
    "sol.g4t": "For Brokers & Operators",
    "sol.g4p": "Workflow automation from intake to closing, with deal tracking, compliance checks, and client reporting.",
    "sol.d1h": "End-to-end AI Brokerage Workflows",
    "sol.d1p": "Kimure connects AI inspection, valuation, matching, finance, and transaction tooling into one brokerage-grade workflow. Each step is designed to reduce manual work, increase trust, and keep every party aligned.",
    "sol.d1li1": "Discovery and qualification with verified listings and intent signals.",
    "sol.d1li2": "AI inspection, risk flags, and enhancement recommendations.",
    "sol.d1li3": "Valuation, pricing strategy, and negotiation intelligence.",
    "sol.d1li4": "Mortgage, agricultural credit, and insurance pathways.",
    "sol.d1li5": "Document management, e-signatures, and regulatory workflows.",
    "sol.d2h": "Built for Real Estate, Rural Land & Agriculture",
    "sol.d2p": "Whether you operate in dense cities, rural communities, or agricultural regions, Kimure adapts solutions to local market structures, regulations, and data availability.",
    "sol.d2li1": "Urban residential and commercial properties.",
    "sol.d2li2": "Rural land, farms, and agricultural infrastructure.",
    "sol.d2li3": "Leasing, co-ownership, and investment structures.",
    "sol.d2li4": "Climate, productivity, and sustainability considerations.",
    "sol.ind.re": "Real Estate",
    "sol.ind.rep": "Kimure solutions for residential and commercial property, listings, valuation, and transaction workflows.",
    "sol.ind.fi": "Finance",
    "sol.ind.fip": "Mortgage pathways, agricultural credit, investor matching, and financial simulation for property and land deals.",
    "sol.ind.ed": "Education",
    "sol.ind.edp": "Resources and tooling for institutions training the next generation of brokers and analysts on AI-assisted markets.",
    "sol.uc.da": "Data Analysis",
    "sol.uc.dap": "Market signals, comparables, geospatial context, and structured inputs for better decisions.",
    "sol.uc.au": "Automation",
    "sol.uc.aup": "Workflow automation from intake through closing, compliance checks, and document routing.",
    "sol.uc.ai": "AI Insights",
    "sol.uc.aip": "Inspection intelligence, pricing scenarios, ROI projections, and personalized recommendations.",
    "sol.tm.su": "Startups",
    "sol.tm.sup": "Lean teams can launch faster with Kimure’s AI brokerage building blocks and marketplace connectivity.",
    "sol.tm.en": "Enterprises",
    "sol.tm.enp": "Scale across regions with standardized verification, lender integrations, and audit-friendly workflows.",
    "sol.ctaH": "See Kimure in action",
    "sol.ctaP": "Explore the marketplace or request early access to the full AI brokerage platform.",
    "sol.reqEarly": "Request Early Access",

    "mp.heroImgAlt": "Professional real estate deal: handshake and property agreement",
    "mp.listingsTitle2": "Featured listings",
    "mp.listing4": "Commercial • Toronto • Canada",
    "mp.listing5": "Residential • 4 Bed • US",
    "mp.listing6": "Farm • Agricultural • Canada",
    "mp.valTitle": "What Kimure delivers",
    "mp.val1h": "Smart AI Brokerage",
    "mp.val1l1": "Automatic matching between buyers, sellers, investors, and landowners",
    "mp.val1l2": "Based on needs, budget, objectives, and location",
    "mp.val2h": "AI Inspection & Due Diligence",
    "mp.val2l1": "Visual inspection via photos, video, satellite, digital scans",
    "mp.val2l2": "Property condition, repair requirements, compliance gaps, enhancement potential",
    "mp.val3h": "Dynamic Pricing & Negotiation",
    "mp.val3l1": "Market valuation, price negotiation scenarios, risk outlook",
    "mp.val3l2": "ROI simulation for investors",
    "mp.val4h": "Financial Brokerage Layer",
    "mp.val4l1": "Mortgage and agricultural credit brokerage",
    "mp.val4l2": "Borrower pre-qualification, automated financial scoring",
    "mp.val4l3": "Connections to banks, fintechs, insurers",
    "mp.val5h": "Agricultural & Rural Land Brokerage",
    "mp.val5l1": "Productivity & profitability evaluation",
    "mp.val5l2": "Climate & sustainability considerations",
    "mp.val5l3": "Investment and leasing structuring",
    "mp.val6h": "Transaction & Closing Hub",
    "mp.val6l1": "Document management, legal & regulatory workflows",
    "mp.val6l2": "E-signatures and compliance support",
    "mp.val6l3": "Partner ecosystem: lawyers, notaries, authorities",
    "mp.val7h": "Value Enhancement & Design AI",
    "mp.val7l1": "Renovation recommendations, energy efficiency improvements",
    "mp.val7l2": "Interior redesign options, post-improvement valuation projection",
    "mp.ctaSellH": "Sell / list your item",
    "mp.ctaSellP": "Get early access to list properties and land on the Kimure marketplace and AI tools.",
    "mp.explorePlat": "Explore Platform",

    "inv.tag": "For Investors",
    "inv.title": "Partner with the AI Brokerage Infrastructure for Real Estate & Land",
    "inv.sub": "Kimure is building trusted infrastructure that transforms how property, rural land, and agricultural assets are discovered, valued, and transacted. We’re seeking investors and partners to scale across Canada, the US, and global markets.",
    "inv.deck": "Request Investor Deck",
    "inv.about": "About Kimure",
    "inv.imgAlt": "Property and keys — real estate ownership and investment opportunity",
    "inv.whyTitle": "Why invest in Kimure",
    "inv.w1t": "Large, fragmented markets",
    "inv.w1p": "Real estate, rural land, and ag finance remain underserved by unified AI and brokerage-grade tooling.",
    "inv.w2t": "Full-stack AI brokerage",
    "inv.w2p": "Inspection, valuation, matching, finance, and closing in one platform—not point solutions.",
    "inv.w3t": "Revenue across the funnel",
    "inv.w3p": "Marketplace, data, financial brokerage, and enterprise workflows create multiple revenue streams.",
    "inv.w4t": "Trust and compliance first",
    "inv.w4p": "Verified listings, document integrity, and regulatory workflows built in from day one.",
    "inv.t1h": "Financials",
    "inv.t1p": "Urban real estate, rural land, and agricultural finance represent trillions in annual transaction volume with growing demand for transparency and speed.",
    "inv.t2h": "Reports",
    "inv.t2p": "Phase rollout Canada → US → Global. Early focus on verified listings, AI valuation, and lender/investor connectivity—investor updates and reports available on request.",
    "inv.t3h": "Team and vision",
    "inv.t3p": "Building the world’s first AI brokerage infrastructure—unifying property, land, and finance with real-time data and decision tools.",
    "inv.t4h": "Get involved",
    "inv.t4p": "Request the investor deck, schedule a call, or join our early-access program for product updates and pilot opportunities.",
    "inv.nextLbl": "Next step",
    "inv.nextTitle": "Request the investor deck",
    "inv.nextText": "Get the full story: market size, product roadmap, unit economics, and how we’re building the AI brokerage layer for real estate and land.",
    "inv.newsTitle": "News / updates",
    "inv.newsP": "Follow Kimure on",
    "inv.newsFor": "for product and funding updates.",
    "inv.govTitle": "Governance",
    "inv.govP": "Kimure is committed to transparent governance, compliance, and responsible AI practices as we scale.",

    "onbIntro.tag": "Get started",
    "onbIntro.h1": "Smart Onboarding",
    "onbIntro.p1suffix": "— AI Brokerage Platform for Real Estate, Rural Land, Agricultural Assets & Financial Services.",
    "onbIntro.p2": "Complete our guided registration to create your account, share your goals and budget, and unlock AI-powered property and investor matching.",
    "onbIntro.start": "Start registration form",
    "onbIntro.home": "Back to home",

    "onb.form.backLink": "← Back to onboarding overview",
    "onb.form.title": "Kimure : AI Brokerage Platform for Real Estate, Rural Land, Agricultural Assets & Financial Services",
    "onb.form.subtitle": "Smart Onboarding Registration Form",
    "onb.form.stepWord": "Step",
    "onb.form.ofWord": "of",
    "onb.wiz.back": "Back",
    "onb.wiz.next": "Next",
    "onb.wiz.create": "Create My Account",
    "onb.wiz.finish": "Finish",
    "onb.wiz.getMatches": "Get My AI Matches",
  },
  fr: {
    "titles.home": "Kimure — Accueil",
    "titles.about": "À propos — Kimure",
    "titles.platform": "Plateforme Kimure",
    "titles.solutions": "Solutions Kimure",
    "titles.marketplace": "Marketplace Kimure",
    "titles.investors": "Investisseurs Kimure",
    "titles.onboarding": "Kimure — Intégration",
    "titles.onboardingForm": "Intégration intelligente — Kimure",
    "titles.legal": "Conformité juridique — Kimure",
    "nav.legal": "Légal et conformité",
    "legal.backHome": "← Retour à l'accueil",
    "legal.backHomeShort": "Accueil",
    "legal.heroTagline": "Plateforme de courtage IA",
    "legal.tocTitle": "Sur cette page",
    themeDark: "Sombre",
    themeLight: "Clair",
    "aria.nav": "Navigation principale",
    "aria.langToggle": "Changer de langue",
    "aria.themeToggle": "Basculer mode sombre ou clair",
    "aria.roadmap": "Feuille de route du déploiement",
    "aria.mock": "Aperçu du tableau de bord Kimure",
    "aria.heroVideo": "Vidéo de présentation Kimure",
    "aria.marketplaceSearch": "Recherche marketplace (aperçu)",
    "aria.featuredListings": "Annonces en vedette",
    "aria.searchListings": "Rechercher des annonces",
    "aria.mpValue": "Ce que Kimure apporte",
    "aria.mpBrowseCategories": "Catégories du marketplace",
    "aria.mpBrowseModes": "Choisir l’intention",
    "aria.mpSubBuy": "Types de biens pour acheteurs",
    "aria.mpSubSale": "Types de biens à vendre",
    "aria.mpSubRent": "Types de locations",
    "aria.mpSubInvest": "Types de placements",
    "aria.mpCatalogGrid": "Annonces correspondant aux filtres",
    "aria.mpIntentBuy": "Annonces — acheter",
    "aria.mpIntentSale": "Annonces — à vendre",
    "aria.mpIntentRent": "Annonces — location",
    "aria.mpIntentInvest": "Annonces — investir",
    "aria.solutionsByIndustry": "Solutions par secteur",
    "aria.solutionsByUseCase": "Solutions par cas d’usage",
    "aria.solutionsForTeams": "Solutions pour les équipes",
    "mp.noResults": "Aucune annonce ne correspond à votre recherche. Essayez un autre lieu, type de bien ou ROI.",
    "aria.social": "Liens sociaux",
    "img.logoAlt": "Logo Kimure",
    "nav.about": "À propos",
    "nav.story": "Notre histoire",
    "nav.mission": "Mission et vision",
    "nav.team": "Équipe",
    "nav.careers": "Carrières",
    "nav.press": "Presse / Médias",
    "nav.contact": "Nous contacter",
    "nav.platform": "Plateforme",
    "nav.overview": "Aperçu",
    "nav.features": "Fonctionnalités",
    "nav.how": "Fonctionnement",
    "nav.mobileSoon": "Application mobile — bientôt",
    "nav.solutions": "Solutions",
    "nav.byIndustry": "Par secteur",
    "nav.realestate": "Immobilier",
    "nav.finance": "Finance",
    "nav.education": "Éducation",
    "nav.byUseCase": "Par cas d’usage",
    "nav.dataAnalysis": "Analyse de données",
    "nav.automation": "Automatisation",
    "nav.aiInsights": "Informations IA",
    "nav.forTeams": "Pour les équipes",
    "nav.startups": "Startups",
    "nav.enterprises": "Grandes entreprises",
    "nav.marketplace": "Marketplace",
    "nav.browseListings": "Parcourir les annonces",
    "nav.allListings": "Toutes les annonces",
    "nav.categories": "Catégories",
    "nav.featured": "En vedette",
    "nav.newArrivals": "Nouveautés",
    "nav.topRated": "Mieux notés",
    "nav.sellItem": "Vendre / Publier une annonce",
    "nav.investors": "Investisseurs",
    "nav.invOverview": "Aperçu",
    "nav.financials": "Données financières",
    "nav.reports": "Rapports",
    "nav.pitchDeck": "Pitch deck",
    "nav.news": "Actualités",
    "nav.governance": "Gouvernance",
    "nav.onboarding": "Intégration",
    "nav.earlyAccess": "Connexion / Inscription",
    "nav.signOut": "Déconnexion",
    "hero.title": "L'Avenir de l'Immobilier, des Terres et de l'Agriculture — Propulsé par l'IA",
    "hero.sub": "Kimure est la première plateforme de courtage IA unifiée au monde pour l'immobilier, les terres rurales, les actifs agricoles et les services financiers. Achetez, vendez, louez, investissez et financez — intelligemment.",
    "hero.explore": "Explorer la Plateforme",
    "hero.startFree": "Connexion / Inscription",
    "hero.bookDemo": "Réserver une Démo",
    "hero.phase": "Phase",
    "hero.phaseVal": "Canada → États-Unis → Monde",
    "hero.core": "Cœur",
    "hero.coreVal": "Appariement • Inspection • Finance",
    "hero.trust": "Confiance",
    "hero.trustVal": "Flux vérifiés et sécurisés",
    "roadmap.label": "Déploiement",
    "roadmap.canada": "Canada",
    "roadmap.us": "É.-U.",
    "roadmap.global": "Monde",
    "mock.title": "Panneau d’intelligence en direct",
    "mock.chip": "Signaux de marché",
    "mock.valuation": "Estimation immobilière IA",
    "mock.estimated": "Estimé",
    "mock.confidence": "Confiance",
    "mock.high": "Élevée",
    "mock.investMatch": "Correspondance investissement",
    "mock.fitScore": "Score d’adéquation",
    "mock.roi": "Projection de ROI",
    "mock.strong": "Forte",
    "mock.mortgage": "Préapprobation hypothécaire",
    "mock.eligible": "Éligible",
    "mock.in24h": "sous 24 h",
    "mock.options": "Options",
    "mock.compareLenders": "Comparer les prêteurs",
    "mock.riskFlags": "Indicateurs de risque",
    "mock.low": "Faible",
    "trust.title": "Des fonctions IA pour la confiance, la rapidité et la clarté",
    "trust.f1t": "Inspection IA",
    "trust.f1p": "Due diligence standardisée à partir de photos, vidéos et imagerie satellite.",
    "trust.f2t": "Appariement intelligent",
    "trust.f2p": "Mise en relation par intention entre acheteurs, vendeurs, investisseurs et institutions.",
    "trust.f3t": "Simulation financière",
    "trust.f3p": "Accessibilité et projections de ROI avec parcours prêteurs et investisseurs.",
    "trust.f4t": "Transactions sécurisées",
    "trust.f4p": "Annonces vérifiées, documents, signatures électroniques, conformité et suivi.",
    "tile1t": "Moteur de courtage IA",
    "tile1p": "Qualification, mise en relation, recommandations et conseil intelligent.",
    "tile2t": "Inspections intelligentes",
    "tile2p": "Estimation des réparations, écarts de conformité et leviers de valeur.",
    "tile3t": "Couche financière de courtage",
    "tile3p": "Prêts hypothécaires, crédit agricole, assurance et mise en relation prêteurs/investisseurs.",
    "tile4t": "Hub transactionnel",
    "tile4p": "Documents, signatures électroniques, flux réglementaires et clôture sécurisée.",
    "mp.title": "Intelligence marketplace",
    "mp.sub": "Achetez, vendez, louez et investissez dans de l’immobilier, des terres rurales et des actifs agricoles vérifiés, guidés par l’IA.",
    "mp.placeholder": "Recherche par lieu, ROI ou type de bien",
    "mp.search": "Rechercher",
    "mp.explore": "Explorer le marketplace",
    "mp.verified": "Vérifié",
    "mp.viewDetails": "Voir les détails →",
    "mp.listing1": "Urbain • 3 ch. • Canada",
    "mp.listing2": "Terre rurale • 48 acres",
    "mp.listing3": "Agricole • Option de location",
    "mp.p1t": "Annonces vérifiées uniquement",
    "mp.p1p": "Vérifications d’identité, validation documentaire et prévention de la fraude.",
    "mp.p2t": "Recherche et appariement IA",
    "mp.p2p": "Découverte selon objectifs, budget, signaux d’intention et profil de risque.",
    "mp.p3t": "Contrats et flux sécurisés",
    "mp.p3p": "Signatures électroniques, contrôles de conformité et suivi des transactions.",
    "mp.p4t": "Réseau prêteurs et investisseurs",
    "mp.p4p": "Préqualification, accessibilité, projections de ROI et approbations.",
    "mp.catTitle": "Acheter, vendre, louer et investir",
    "mp.catLead": "Les mêmes cartes que les annonces vedettes, regroupées selon votre intention. La recherche filtre chaque section.",
    "mp.intentEmpty": "Aucune annonce ne correspond à votre recherche dans cette section.",
    "mp.modeBuy": "Acheter",
    "mp.modeSale": "À vendre",
    "mp.modeRent": "Louer",
    "mp.modeInvest": "Investir",
    "mp.cat.all": "Tous les types",
    "mp.cat.urbanFarm": "Fermes urbaines",
    "mp.cat.apartment": "Appartements et condos",
    "mp.cat.rural": "Maisons et terres rurales",
    "mp.cat.commercial": "Commercial",
    "mp.cat.agricultural": "Terres agricoles",
    "mp.cat.landLot": "Lots et terrains à développer",
    "mp.cat.house": "Maisons unifamiliales",
    "mp.cat.sellUrbanFarm": "Fermes urbaines et parcelles agri",
    "mp.cat.sellApartment": "Appartements et condos",
    "mp.cat.sellRural": "Propriétés rurales et superficies",
    "mp.cat.sellHouse": "Maisons unifamiliales",
    "mp.cat.sellCommercial": "Immeubles commerciaux",
    "mp.cat.sellAg": "Terres agricoles et fermes",
    "mp.cat.sellLandLot": "Terrains vacants et lots",
    "mp.cat.rentApt": "Appartements et condos",
    "mp.cat.rentHouse": "Maisons",
    "mp.cat.rentUrbanFarm": "Fermes urbaines et micro-fermes",
    "mp.cat.rentCommercial": "Commercial et commerce de détail",
    "mp.cat.rentFarmland": "Bail de terres agricoles",
    "mp.cat.rentShort": "Court terme et flexible",
    "mp.cat.invRural": "Terres rurales et superficies",
    "mp.cat.invUrbanFarm": "Fermes urbaines et actifs agri",
    "mp.cat.invCommercial": "Revenus commerciaux",
    "mp.cat.invMultifamily": "Multilogements et condos",
    "mp.cat.invSf": "Unifamiliales locatives et portefeuilles",
    "mp.cat.invDev": "Développement et préconstruction",
    "mp.cat.invSynd": "Syndications et fonds",
    "vision.label": "Vision",
    "vision.title": "Bâtir la première infrastructure de courtage IA au monde",
    "vision.text": "Kimure transforme des marchés fragmentés en un écosystème transactionnel unifié, intelligent et sécurisé, porté par l’IA, les données en temps réel, la géospatial et des outils de décision financière.",
    "vision.requestDeck": "Demander la présentation investisseurs",
    "vision.exploreCases": "Voir les cas d’usage",
    "footer.rights": "Kimure propulsé par Kimuntu Power Inc. Tous droits réservés.",
    "footer.powered": "Plateforme de courtage IA pour l'immobilier, les terres rurales et les services financiers.",
    "footer.colPlatform": "Plateforme",
    "footer.colSolutions": "Solutions",
    "footer.colResources": "Ressources",
    "footer.colCompany": "Entreprise",
    "footer.link.marketplace": "Marché",
    "footer.link.buyerHub": "Hub Acheteur",
    "footer.link.sellerHub": "Hub Vendeur",
    "footer.link.rentalHub": "Hub Location",
    "footer.link.landRural": "Terres et Rural",
    "footer.link.agriAssets": "Actifs agricoles",
    "footer.link.financing": "Financement",
    "footer.link.aiSim": "Simulation IA",
    "footer.link.inspector": "Inspecteur IA",
    "footer.link.buy": "Acheter de l'immobilier",
    "footer.link.sell": "Vendre de l'immobilier",
    "footer.link.rent": "Louer une propriété",
    "footer.link.leaseAgri": "Bail agricole",
    "footer.link.invest": "Opportunités d'investissement",
    "footer.link.valuation": "Évaluation immobilière",
    "footer.link.mortgage": "Prêts et hypothèques",
    "footer.link.insurance": "Courtage en assurance",
    "footer.link.matching": "Mise en correspondance",
    "footer.link.landAnalytics": "Analytique des terres et sols",
    "footer.link.ruralFinance": "Dév. rural et agri-finance",
    "footer.link.building": "Projets de construction",
    "footer.link.blog": "Blogue et perspectives",
    "footer.link.trends": "Tendances du marché",
    "footer.link.pricing": "Tarification",
    "footer.link.docs": "Documentation et guides",
    "footer.link.faq": "FAQ",
    "footer.link.community": "Communauté et forum",
    "footer.link.api": "API développeur",
    "footer.link.about": "À propos",
    "footer.link.careers": "Carrières",
    "footer.link.partners": "Partenariats",
    "footer.link.press": "Presse et médias",
    "footer.link.contact": "Contact / Centre d'aide",
    "footer.legal.terms": "Conditions d'utilisation",
    "footer.legal.privacy": "Confidentialité",
    "footer.legal.cookies": "Politique sur les cookies",
    "footer.legal.data": "Protection des données",
    "footer.legal.verify": "Vérification des utilisateurs",
    "footer.legal.antifraud": "Anti-fraude et conformité",
    "footer.legal.fairhousing": "Logement équitable",
    "footer.legal.broker": "Licences de courtage",
    "home.badge1": "Intelligence propulsée par l'IA",
    "home.badge2": "Transactions vérifiées par blockchain",
    "home.badge3": "Conforme LPRPDE · RGPD · LCAP",
    "home.badge4": "Au service des acheteurs, vendeurs, investisseurs, agriculteurs et professionnels",
    "home.whatH": "Qu'est-ce que Kimure ?",
    "home.whatP": "Kimure est un écosystème de courtage propulsé par l'IA qui regroupe tout ce dont vous avez besoin pour naviguer dans les décisions immobilières, foncières et financières en un seul endroit.",
    "home.whatImgAlt": "Maison contemporaine au crépuscule — résidentiel haut de gamme",
    "home.pillarsH": "Piliers de la plateforme",
    "home.p1t": "Courtage immobilier",
    "home.p1d": "Achetez, vendez et louez des biens résidentiels, commerciaux et d'investissement avec l'IA.",
    "home.p2t": "Intelligence des terres rurales",
    "home.p2d": "Découvrez et évaluez les terres agricoles et rurales avec analytique des sols et prévisions de rendement.",
    "home.p3t": "Actifs agricoles",
    "home.p3d": "Évaluez l'infrastructure agricole, le potentiel des cultures et l'agri-finance.",
    "home.p4t": "Courtage financier",
    "home.p4d": "Simulation hypothécaire, préqualification et mise en correspondance d'assurance.",
    "home.p5t": "Inspection et évaluation IA",
    "home.p5d": "L'Inspecteur IA livre des rapports d'état et des évaluations instantanés.",
    "home.p6t": "CRM et moteur de croissance",
    "home.p6d": "Gestion des leads, ciblage d'audience et marketing automatisé par IA.",
    "home.howH": "Comment ça fonctionne",
    "home.step1l": "Découvrez",
    "home.step1p": "Recherchez des annonces vérifiées avec des filtres IA intelligents.",
    "home.step2l": "Correspondance",
    "home.step2p": "L'IA de Kimure analyse votre profil et votre capacité financière pour recommander les meilleures opportunités.",
    "home.step3l": "Transigez",
    "home.step3p": "Complétez des transactions sécurisées avec blockchain, signatures électroniques et outils financiers.",
    "home.whoH": "Qui sert Kimure",
    "home.whoColRole": "Profil",
    "home.whoColHelp": "Comment Kimure aide",
    "home.who1r": "Primo-accédants",
    "home.who1h": "Conseils IA, simulation d'accessibilité, préqualification hypothécaire.",
    "home.who2r": "Investisseurs immobiliers",
    "home.who2h": "Prévisions de ROI, tableaux de bord, intelligence des risques.",
    "home.who3r": "Agents immobiliers",
    "home.who3h": "CRM complet, scoring des leads, marketing IA, intégration MLS.",
    "home.who4r": "Agriculteurs et propriétaires fonciers",
    "home.who4h": "Analytique des sols, prévisions de rendement, accès agri-finance.",
    "home.who5r": "Propriétaires et gestionnaires",
    "home.who5h": "Sélection des locataires, hub location, contrats électroniques.",
    "home.who6r": "Demandes d'hypothèque",
    "home.who6h": "Comparaison des prêteurs, préqualification, simulation de taux.",
    "home.who7r": "Promoteurs et constructeurs",
    "home.who7h": "Projets de construction, financement construction, préventes.",
    "home.who8r": "Investisseurs agricoles",
    "home.who8h": "Intelligence foncière, outils agri-REIT, analytique d'investissement.",
    "home.testH": "Témoignages",
    "home.test1q": "« Kimure m'a trouvé une terre productive que je n'aurais jamais découverte seule. Le rapport sur les sols était incroyablement détaillé. »",
    "home.test1m": "— Marie T., investisseuse agricole, Ontario",
    "home.test2q": "« De la préqualification à la clôture, la plateforme a gardé chaque étape organisée. La correspondance IA m'a fait gagner des semaines. »",
    "home.test2m": "— Jordan K., primo-accédant",
    "home.test3q": "« Notre équipe a enfin un CRM qui relie annonces, prospects et conformité sans jongler cinq outils. »",
    "home.test3m": "— Samira R., responsable de courtage",
    "home.blogH": "Derniers articles du blogue",
    "home.blog1t": "Tendances du logement au Canada T1 : ce que les acheteurs doivent surveiller",
    "home.blog1c": "Tendances du marché",
    "home.blog1d": "12 mars 2026",
    "home.blog2t": "Santé des sols 101 : lire un rapport d'intelligence foncière Kimure",
    "home.blog2c": "Intelligence agricole",
    "home.blog2d": "5 mars 2026",
    "home.blog3t": "Financer les préventes : la checklist du promoteur",
    "home.blog3c": "Projets de construction",
    "home.blog3d": "28 févr. 2026",
    "home.blogRead": "Lire la suite",
    "home.partnersH": "Partenaires et confiance",
    "home.partnersP": "Partenaires prêteurs, affiliations aux chambres immobilières, partenaires technologiques et organismes de réglementation.",
    "home.footerCtaH": "Prêt à transformer votre parcours immobilier ?",
    "home.footerCtaSub": "Rejoignez des milliers d'acheteurs, vendeurs, investisseurs et professionnels qui utilisent déjà Kimure.",
    "home.footerCta1": "Connexion / Inscription",
    "home.footerCta2": "Réserver une démo",
    "home.footerCta3": "Parler à un expert",
    "social.facebook": "Facebook",
    "social.linkedin": "LinkedIn",
    "social.email": "Courriel",
    "demo.dialogAria": "Voir la vidéo de démonstration",
    "demo.closeAria": "Fermer",
    "demo.iframeTitle": "Vidéo de démonstration Kimure",
    "demo.fallbackBefore": "La vidéo ne s’affiche pas ?",
    "demo.fallbackLink": "Voir sur Facebook",
    "earlyAccess.placeholder": "vous@exemple.com",
    "earlyAccess.closeBtn": "Fermer",
    "auth.title": "Connexion ou inscription",
    "auth.sub": "Accédez à votre compte Kimure ou poursuivez l’inscription intelligente.",
    "auth.tabLogin": "Connexion",
    "auth.tabSignUp": "Inscription",
    "auth.emailLabel": "Courriel",
    "auth.passwordLabel": "Mot de passe",
    "auth.passwordPlaceholder": "Entrez votre mot de passe",
    "auth.loginSubmit": "Se connecter",
    "auth.loginErrorInvalid": "Courriel ou mot de passe incorrect. Veuillez réessayer.",
    "auth.loginErrorEmailConfirm": "Veuillez confirmer votre courriel avant de vous connecter.",
    "auth.loginErrorGeneric": "Connexion impossible. Veuillez réessayer.",
    "auth.signUpIntro": "Créez votre compte avec notre formulaire d’inscription intelligent : lien courriel, mot de passe, profil, objectifs et correspondance IA.",
    "auth.signUpContinue": "Continuer vers l’inscription",
    "auth.signUpNote": "Vous vérifierez votre courriel, définirez votre mot de passe et compléterez les étapes 1 à 10.",
    "auth.loginSuccess": "Vous êtes connecté.",
    "auth.forgotPassword": "Mot de passe oublié ?",
    "auth.resetTitle": "Réinitialiser votre mot de passe",
    "auth.resetSub": "Entrez votre courriel et nous vous enverrons un lien de réinitialisation.",
    "auth.resetSubmit": "Envoyer le lien",
    "auth.resetBack": "Retour à la connexion",
    "auth.resetSuccess": "Courriel de réinitialisation envoyé. Vérifiez votre boîte de réception.",
    "auth.resetErrorGeneric": "Impossible d’envoyer le courriel de réinitialisation. Veuillez réessayer.",

    "ab.tag": "À propos de Kimure",
    "ab.title": "La couche de courtage IA pour l’immobilier, les terres et la finance",
    "ab.sub": "Kimure bâtit une infrastructure IA fiable qui aide acheteurs, vendeurs, investisseurs et institutions à découvrir, vérifier, valoriser et conclure avec rapidité, clarté et sécurité.",
    "ab.reqAccess": "Demander un accès anticipé",
    "ab.explore": "Découvrir la plateforme",
    "ab.missionH": "Notre mission",
    "ab.missionP": "Rendre les transactions immobilières et foncières plus intelligentes et sûres en combinant vérification, analyses IA et outils financiers dans un flux digne d’un courtier.",
    "ab.whyH": "Pourquoi Kimure",
    "ab.whyP": "Ces marchés sont fragmentés. Les données sont incohérentes. La confiance coûte cher. Kimure structure découverte, diligence et exécution pour des décisions plus rapides et fiables.",
    "ab.buildH": "Ce que nous construisons",
    "ab.v1h": "Vérification et confiance",
    "ab.v1p": "Annonces vérifiées, validation documentaire, contrôles d’identité et flux de conformité.",
    "ab.v2h": "Valorisation et intelligence IA",
    "ab.v2p": "Prix, scores de confiance, signaux de marché, contexte géospatial et scénarios d’investissement.",
    "ab.v3h": "Appariement et routage des transactions",
    "ab.v3p": "Mise en relation par intention entre acheteurs, vendeurs, investisseurs, prêteurs et institutions.",
    "ab.v4h": "Couche financière",
    "ab.v4p": "Simulation d’accessibilité, comparaison de prêteurs, parcours hypothécaires et projections de ROI.",
    "ab.forH": "Pour qui",
    "ab.f1h": "Acheteurs et vendeurs",
    "ab.f1p": "Trouvez des opportunités vérifiées, réduisez les risques et avancez avec confiance dans vos transactions.",
    "ab.f2h": "Investisseurs",
    "ab.f2p": "Comparez les opérations avec analyses IA, projections financières et signaux de confiance.",
    "ab.f3h": "Prêteurs et institutions",
    "ab.f3p": "Normalisez les données, accélérez la décision et améliorez la visibilité du souscription.",
    "ab.f4h": "Courtiers et opérateurs",
    "ab.f4p": "Enrichissez vos flux avec diligence intelligente, appariement plus rapide et exécution conforme.",
    "ab.howH": "Fonctionnement",
    "ab.step1": "Découvrez des annonces vérifiées avec une recherche guidée par l’IA.",
    "ab.step2": "Validez identité, documents et signaux de risque.",
    "ab.step3": "Valorisez avec estimation IA, comparables et signaux de marché.",
    "ab.step4": "Concluez via des flux sécurisés, signatures électroniques et jalons suivis.",
    "ab.step5": "Financez avec des parcours prêteurs et scénarios d’investissement.",
    "ab.discover": "Découvrir",
    "ab.validate": "Valider",
    "ab.value": "Valoriser",
    "ab.transact": "Conclure",
    "ab.finance": "Financer",
    "ab.trustDesignH": "Confiance par conception",
    "ab.trust1": "Annonces vérifiées et diligence standardisée",
    "ab.trust2": "Flux auditables et suivi clair des transactions",
    "ab.trust3": "Données sécurisées et accès par rôles",
    "ab.trust4": "Contrôles de conformité et intégrité documentaire",
    "ab.teamH": "Équipe",
    "ab.teamP": "Kimure est bâti par une équipe à l’intersection immobilier, IA, marchés fonciers et infrastructure financière sécurisée.",
    "ab.careersH": "Carrières",
    "ab.careersP": "Nous grandissons. Pour rejoindre Kimure, écrivez-nous via Contact avec votre parcours et vos intérêts.",
    "ab.pressH": "Presse / Médias",
    "ab.pressP": "Pour entretiens et supports médias, contactez-nous via les canaux ci-dessous.",
    "ab.contactH": "Nous contacter",
    "ab.contactLead": "Questions, démonstrations et partenariats — nous sommes là pour vous aider.",
    "ab.contactEmailLabel": "Courriel d’assistance",
    "ab.contactLinkedInLabel": "LinkedIn",
    "ab.contactLinkedInValue": "Page entreprise",
    "ab.finalH": "Construire avec Kimure",
    "ab.finalP": "Investisseurs, partenaires ou premiers utilisateurs : partageons la feuille de route et vos retours.",
    "ab.finalDeck": "Demander la présentation investisseurs",
    "ab.finalHome": "Retour à l’accueil",

    "pl.tag": "Plateforme",
    "pl.title": "La plateforme de courtage IA pour l’immobilier, les terres et la finance",
    "pl.sub": "Une plateforme unifiée : qualification et mise en relation, inspection et estimation IA, courtage financier et clôture sécurisée — pour acheteurs, vendeurs, investisseurs, prêteurs et opérateurs.",
    "pl.exploreMp": "Explorer le marketplace",
    "pl.trustTitle": "Modules clés de la plateforme",
    "pl.f1t": "Moteur de courtage IA",
    "pl.f1p": "Qualification, mise en relation, recommandations et intelligence conseil pour biens, terres et finance.",
    "pl.f2t": "Inspections intelligentes",
    "pl.f2p": "Estimation des réparations, écarts de conformité, potentiel de valeur et flux d’inspection à partir de photos et données.",
    "pl.f3t": "Couche financière de courtage",
    "pl.f3p": "Prêts hypothécaires, crédit agricole, assurance et liaisons directes avec prêteurs et investisseurs.",
    "pl.f4t": "Hub transactionnel",
    "pl.f4p": "Documents, signatures électroniques, flux réglementaires et clôture sécurisée avec piste d’audit.",
    "pl.tile1t": "Découverte et appariement",
    "pl.tile1p": "Découverte par intention, annonces vérifiées et appariement IA entre parties.",
    "pl.tile2t": "Valorisation et intelligence",
    "pl.tile2p": "Valeur de marché, projections de ROI, risques et contexte géospatial — au même endroit pour décider vite.",
    "pl.tile3t": "Finance et prêt",
    "pl.tile3p": "Préqualification, accessibilité, comparaison de prêteurs et parcours de crédit agricole intégrés au flux.",
    "pl.tile4t": "Clôture et conformité",
    "pl.tile4p": "Documents, signatures électroniques, contrôles réglementaires et intégrations partenaires (avocats, notaires, autorités).",
    "pl.visionLbl": "Conçu pour l’échelle",
    "pl.visionTitle": "Une plateforme pour chaque étape du deal",
    "pl.visionText": "De la première recherche à la clôture, Kimure regroupe inspection, valorisation, appariement, finance et conformité dans un flux de niveau courtier — pour avancer plus vite avec clarté et confiance.",
    "pl.visionMp": "Explorer le marketplace",

    "sol.heroTag": "Solutions",
    "sol.heroTitle": "Solutions pour l’immobilier, les terres rurales, l’agriculture et les services financiers",
    "sol.heroSub": "Kimure fournit une couche de courtage IA qui standardise inspection, appariement, valorisation, finance et clôture sur des marchés fragmentés.",
    "sol.heroImgAlt": "Vision d’une maison dans la main — innovation et possibles",
    "sol.capTitle": "Capacités IA intégrées à chaque solution Kimure",
    "sol.c1t": "Inspection IA et diligence",
    "sol.c1p": "Photos, vidéo et satellite pour évaluer état, réparations, conformité et potentiel.",
    "sol.c2t": "Appariement intelligent et routage marketplace",
    "sol.c2p": "Mise en relation par intention entre acheteurs, vendeurs, investisseurs, prêteurs et opérateurs.",
    "sol.c3t": "Valorisation, prix et négociation",
    "sol.c3p": "Valeur de marché, scénarios de négociation, risque et simulations de ROI.",
    "sol.c4t": "Transactions sécurisées et clôture",
    "sol.c4p": "Annonces vérifiées, documents, signatures électroniques et suivi de conformité.",
    "sol.g1t": "Pour acheteurs et vendeurs",
    "sol.g1p": "Découverte, vérification, valorisation et finance pour immobilier urbain et actifs ruraux dans un seul flux.",
    "sol.g2t": "Pour investisseurs et fonds",
    "sol.g2p": "Analytique prête portefeuille, projections ROI, scénarios et routage d’opérations multi-régions.",
    "sol.g3t": "Pour prêteurs et assureurs",
    "sol.g3p": "Données standardisées, intelligence d’inspection et notation du risque pour crédit et couverture.",
    "sol.g4t": "Pour courtiers et opérateurs",
    "sol.g4p": "Automatisation de l’intake à la clôture, suivi, conformité et reporting client.",
    "sol.d1h": "Flux de bout en bout IA",
    "sol.d1p": "Kimure relie inspection, valorisation, appariement, finance et transaction dans un flux de niveau courtier pour réduire la charge manuelle et renforcer la confiance.",
    "sol.d1li1": "Découverte et qualification avec annonces vérifiées et intentions.",
    "sol.d1li2": "Inspection IA, signaux de risque et recommandations de valorisation.",
    "sol.d1li3": "Stratégie de prix, négociation et intelligence de valorisation.",
    "sol.d1li4": "Hypothèques, crédit agricole et assurances.",
    "sol.d1li5": "Documents, signatures électroniques et flux réglementaires.",
    "sol.d2h": "Pour l’immobilier, les terres et l’agriculture",
    "sol.d2p": "En ville, en milieu rural ou agricole, Kimure adapte les solutions aux marchés, réglementations et données locales.",
    "sol.d2li1": "Résidentiel et commercial urbain.",
    "sol.d2li2": "Terres rurales, fermes et infrastructures agricoles.",
    "sol.d2li3": "Location, co-propriété et structures d’investissement.",
    "sol.d2li4": "Climat, productivité et durabilité.",
    "sol.ind.re": "Immobilier",
    "sol.ind.rep": "Solutions Kimure pour annonces, valorisation et transactions résidentielles et commerciales.",
    "sol.ind.fi": "Finance",
    "sol.ind.fip": "Hypothèques, crédit agricole, investisseurs et simulation pour biens et terres.",
    "sol.ind.ed": "Éducation",
    "sol.ind.edp": "Ressources pour former courtiers et analystes aux marchés assistés par l’IA.",
    "sol.uc.da": "Analyse de données",
    "sol.uc.dap": "Signaux de marché, comparables, géospatial et données structurées.",
    "sol.uc.au": "Automatisation",
    "sol.uc.aup": "Automatisation intake–clôture, conformité et routage documentaire.",
    "sol.uc.ai": "Informations IA",
    "sol.uc.aip": "Inspection, scénarios de prix, ROI et recommandations personnalisées.",
    "sol.tm.su": "Startups",
    "sol.tm.sup": "Lancez plus vite avec les briques de courtage IA et le marketplace.",
    "sol.tm.en": "Grandes entreprises",
    "sol.tm.enp": "Déployez à grande échelle avec vérification standardisée, intégrations prêteurs et flux auditables.",
    "sol.ctaH": "Voir Kimure en action",
    "sol.ctaP": "Explorez le marketplace ou demandez l’accès à la plateforme complète.",
    "sol.reqEarly": "Demander l’accès anticipé",

    "mp.heroImgAlt": "Transaction immobilière professionnelle : poignée de main et accord",
    "mp.listingsTitle2": "Annonces en vedette",
    "mp.listing4": "Commercial • Toronto • Canada",
    "mp.listing5": "Résidentiel • 4 ch. • É.-U.",
    "mp.listing6": "Ferme • Agricole • Canada",
    "mp.valTitle": "Ce que Kimure apporte",
    "mp.val1h": "Courtage IA intelligent",
    "mp.val1l1": "Appariement automatique entre acheteurs, vendeurs, investisseurs et propriétaires fonciers",
    "mp.val1l2": "Selon besoins, budget, objectifs et lieu",
    "mp.val2h": "Inspection IA et diligence",
    "mp.val2l1": "Inspection visuelle par photos, vidéo, satellite, numérisation",
    "mp.val2l2": "État, travaux, conformité, potentiel de valeur",
    "mp.val3h": "Prix dynamique et négociation",
    "mp.val3l1": "Valorisation, scénarios de négociation, risque",
    "mp.val3l2": "Simulation de ROI pour investisseurs",
    "mp.val4h": "Couche financière de courtage",
    "mp.val4l1": "Courtage hypothécaire et crédit agricole",
    "mp.val4l2": "Préqualification emprunteur, scoring automatisé",
    "mp.val4l3": "Connexions banques, fintechs, assureurs",
    "mp.val5h": "Courtage terres rurales et agricoles",
    "mp.val5l1": "Évaluation productivité et rentabilité",
    "mp.val5l2": "Climat et durabilité",
    "mp.val5l3": "Structuration investissement et location",
    "mp.val6h": "Hub transaction et clôture",
    "mp.val6l1": "Documents, flux juridiques et réglementaires",
    "mp.val6l2": "Signatures électroniques et conformité",
    "mp.val6l3": "Écosystème : avocats, notaires, autorités",
    "mp.val7h": "Valeur et design IA",
    "mp.val7l1": "Travaux, efficacité énergétique",
    "mp.val7l2": "Design intérieur et projection de valeur après travaux",
    "mp.ctaSellH": "Vendre / publier une annonce",
    "mp.ctaSellP": "Accès anticipé pour publier biens et terres sur le marketplace et les outils IA.",
    "mp.explorePlat": "Découvrir la plateforme",

    "inv.tag": "Pour investisseurs",
    "inv.title": "Partenaires de l’infrastructure de courtage IA pour l’immobilier et les terres",
    "inv.sub": "Kimure bâtit une infrastructure qui transforme découverte, valorisation et transaction des biens, terres rurales et actifs agricoles. Nous cherchons investisseurs et partenaires pour scaler Canada, États-Unis et marchés mondiaux.",
    "inv.deck": "Demander la présentation investisseurs",
    "inv.about": "À propos de Kimure",
    "inv.imgAlt": "Propriété et clés — opportunité d’investissement",
    "inv.whyTitle": "Pourquoi investir dans Kimure",
    "inv.w1t": "Marchés vastes et fragmentés",
    "inv.w1p": "Immobilier, terres et finance agricole manquent encore d’outils unifiés IA et courtage.",
    "inv.w2t": "Courtage IA complet",
    "inv.w2p": "Inspection, valorisation, appariement, finance et clôture sur une plateforme — pas des silos.",
    "inv.w3t": "Revenus sur le tunnel",
    "inv.w3p": "Marketplace, données, courtage financier et workflows entreprise.",
    "inv.w4t": "Confiance et conformité d’abord",
    "inv.w4p": "Annonces vérifiées, intégrité documentaire et flux réglementaires dès le départ.",
    "inv.t1h": "Données financières",
    "inv.t1p": "Immobilier urbain, terres et finance agricole : des volumes énormes avec besoin de transparence et de vitesse.",
    "inv.t2h": "Rapports",
    "inv.t2p": "Déploiement Canada → É.-U. → Monde. Priorité : annonces vérifiées, valorisation IA et liens prêteurs/investisseurs — rapports sur demande.",
    "inv.t3h": "Équipe et vision",
    "inv.t3p": "Bâtir la première infrastructure de courtage IA au monde — biens, terres et finance avec données temps réel.",
    "inv.t4h": "S’impliquer",
    "inv.t4p": "Demandez le deck, planifiez un appel ou rejoignez l’accès anticipé pour pilotes et mises à jour.",
    "inv.nextLbl": "Étape suivante",
    "inv.nextTitle": "Demander la présentation investisseurs",
    "inv.nextText": "Taille de marché, feuille de route produit, unit economics et vision de la couche de courtage IA.",
    "inv.newsTitle": "Actualités",
    "inv.newsP": "Suivez Kimure sur",
    "inv.newsFor": "pour produit et financement.",
    "inv.govTitle": "Gouvernance",
    "inv.govP": "Kimure s’engage pour une gouvernance transparente, la conformité et une IA responsable à mesure qu’on scale.",

    "onbIntro.tag": "Commencer",
    "onbIntro.h1": "Intégration intelligente",
    "onbIntro.p1suffix": "— plateforme de courtage IA pour l’immobilier, les terres rurales, l’agriculture et les services financiers.",
    "onbIntro.p2": "Complétez notre inscription guidée pour créer votre compte, partager objectifs et budget, et activer l’appariement IA de biens et investisseurs.",
    "onbIntro.start": "Ouvrir le formulaire d’inscription",
    "onbIntro.home": "Retour à l’accueil",

    "onb.form.backLink": "← Retour à l’aperçu d’intégration",
    "onb.form.title": "Kimure : plateforme de courtage IA pour l’immobilier, les terres rurales, les actifs agricoles et les services financiers",
    "onb.form.subtitle": "Formulaire d’inscription intelligent",
    "onb.form.stepWord": "Étape",
    "onb.form.ofWord": "sur",
    "onb.wiz.back": "Retour",
    "onb.wiz.next": "Suivant",
    "onb.wiz.create": "Créer mon compte",
    "onb.wiz.finish": "Terminer",
    "onb.wiz.getMatches": "Obtenir mes correspondances IA",
  },
};

const body = document.body;
const toggle = document.getElementById("themeToggle");
const toggleText = toggle ? toggle.querySelector(".toggle-text") : null;

function getLang() {
  return localStorage.getItem("kimureLang") === "fr" ? "fr" : "en";
}

function refreshChromeLabels() {
  const lang = getLang();
  const dict = I18N[lang];
  const langLabel = document.querySelector(".toggle-text-lang");
  if (langLabel) langLabel.textContent = lang === "fr" ? "FR" : "EN";
  if (toggleText)
    toggleText.textContent = body.classList.contains("theme-dark") ? dict.themeDark : dict.themeLight;
  const titleKey = body.getAttribute("data-i18n-title-key");
  if (titleKey && dict[titleKey] != null) document.title = dict[titleKey];
}

function applyI18n() {
  const lang = getLang();
  const dict = I18N[lang];
  document.documentElement.lang = lang;
  if (typeof window !== "undefined") window.KIMURE_I18N_DICT = dict;
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    const key = el.getAttribute("data-i18n");
    if (key && dict[key] != null) el.textContent = dict[key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
    const key = el.getAttribute("data-i18n-placeholder");
    if (key && dict[key] != null) el.placeholder = dict[key];
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach(function (el) {
    const key = el.getAttribute("data-i18n-aria-label");
    if (key && dict[key] != null) el.setAttribute("aria-label", dict[key]);
  });
  document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
    const key = el.getAttribute("data-i18n-title");
    if (key && dict[key] != null) el.setAttribute("title", dict[key]);
  });
  document.querySelectorAll("[data-i18n-alt]").forEach(function (el) {
    const key = el.getAttribute("data-i18n-alt");
    if (key && dict[key] != null) el.setAttribute("alt", dict[key]);
  });
  refreshChromeLabels();
  document.dispatchEvent(new CustomEvent("kimure-i18n-applied", { detail: { lang: lang } }));
}

function setTheme(theme) {
  body.classList.remove("theme-dark", "theme-light");
  body.classList.add(theme);
  localStorage.setItem("kimureTheme", theme);
  refreshChromeLabels();
}

applyI18n();
setTheme(localStorage.getItem("kimureTheme") || "theme-dark");

if (toggle) {
  toggle.addEventListener("click", function () {
    const isDark = body.classList.contains("theme-dark");
    setTheme(isDark ? "theme-light" : "theme-dark");
  });
}

const langToggle = document.getElementById("langToggle");
if (langToggle) {
  langToggle.addEventListener("click", function () {
    localStorage.setItem("kimureLang", getLang() === "fr" ? "en" : "fr");
    applyI18n();
  });
}

(function () {
  const heroVideo = document.querySelector(".hero-video");
  if (!heroVideo || heroVideo.tagName !== "VIDEO") return;
  function tryPlay() {
    const p = heroVideo.play();
    if (p && typeof p.catch === "function") p.catch(function () {});
  }
  heroVideo.muted = true;
  heroVideo.addEventListener("ended", function () {
    heroVideo.currentTime = 0;
    tryPlay();
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) tryPlay();
  });
})();

// Count-up stat (only if present)
function formatCompact(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function animateStat(el) {
  const to = Number(el.dataset.to || 0);
  const prefix = el.dataset.prefix || "";
  const suffix = el.dataset.suffix || "";
  const out = el.querySelector(".stat-value");
  if (!out) return;

  const duration = 900;
  const t0 = performance.now();

  function tick(now) {
    const p = Math.min((now - t0) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.floor((to) * eased);
    out.textContent = prefix + formatCompact(val) + suffix;

    if (p < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

const statCard = document.querySelector(".card.stat");
if (statCard) animateStat(statCard);

// Login / Sign up modal
(function () {
  var overlay = document.getElementById("earlyAccessOverlay");
  var mainEl = document.getElementById("authModalMain");
  var loginSuccessEl = document.getElementById("authLoginSuccess");
  var loginForm = document.getElementById("loginForm");
  var loginEmail = document.getElementById("loginEmail");
  var loginPassword = document.getElementById("loginPassword");
  var tabLogin = document.getElementById("authTabLogin");
  var tabSignUp = document.getElementById("authTabSignUp");
  var panelLogin = document.getElementById("authPanelLogin");
  var panelSignUp = document.getElementById("authPanelSignUp");
  var closeBtn = document.getElementById("earlyAccessClose");
  var closeAfterBtn = document.getElementById("earlyAccessCloseAfter");
  var authModalTitle = document.getElementById("authModalTitle");
  var authModalSub = document.querySelector("#authModalMain .early-access-sub");
  var loginErrorEl = null;
  var resetPanel = null;
  var forgotLink = null;

  function tAuth(key, fallback) {
    var d = window.KIMURE_I18N_DICT;
    return d && d[key] != null ? d[key] : fallback;
  }

  function ensureLoginErrorEl() {
    if (!loginForm) return null;
    if (loginErrorEl) return loginErrorEl;
    var loginSubmitBtn = loginForm.querySelector('button[type="submit"]');
    loginErrorEl = document.createElement("p");
    loginErrorEl.id = "loginFormError";
    loginErrorEl.className = "auth-login-error";
    loginErrorEl.setAttribute("role", "alert");
    loginErrorEl.hidden = true;
    if (loginSubmitBtn) {
      loginForm.insertBefore(loginErrorEl, loginSubmitBtn);
    } else {
      loginForm.appendChild(loginErrorEl);
    }
    return loginErrorEl;
  }

  function showLoginError(message) {
    var el = ensureLoginErrorEl();
    if (!el) return;
    el.textContent = message || "";
    el.hidden = !message;
  }

  function formatLoginError(error) {
    if (!error || !error.message) {
      return tAuth("auth.loginErrorGeneric", "Could not log in. Please try again.");
    }

    var msg = error.message.toLowerCase();
    if (msg.indexOf("invalid login credentials") >= 0 || msg.indexOf("invalid credentials") >= 0) {
      return tAuth("auth.loginErrorInvalid", "Wrong email or password. Please try again.");
    }
    if (msg.indexOf("email not confirmed") >= 0) {
      return tAuth("auth.loginErrorEmailConfirm", "Please confirm your email before logging in.");
    }

    return error.message;
  }

  function clearLoginError() {
    showLoginError("");
  }

  function ensureForgotPasswordLink() {
    if (!loginForm) return null;
    if (forgotLink) return forgotLink;

    var loginSubmitBtn = loginForm.querySelector('button[type="submit"]');
    forgotLink = document.createElement("button");
    forgotLink.type = "button";
    forgotLink.className = "auth-forgot-link";
    forgotLink.setAttribute("data-i18n", "auth.forgotPassword");
    forgotLink.textContent = tAuth("auth.forgotPassword", "Forgot password?");
    forgotLink.addEventListener("click", function (e) {
      e.preventDefault();
      showResetPasswordView();
    });

    if (loginSubmitBtn) {
      loginForm.insertBefore(forgotLink, loginSubmitBtn);
    } else {
      loginForm.appendChild(forgotLink);
    }

    return forgotLink;
  }

  function ensureResetPanel() {
    if (!panelLogin) return null;
    if (resetPanel) return resetPanel;

    resetPanel = document.createElement("div");
    resetPanel.id = "authResetPanel";
    resetPanel.className = "auth-reset-panel";
    resetPanel.hidden = true;
    resetPanel.innerHTML =
      '<p class="auth-reset-copy" data-i18n="auth.resetSub">Enter your email and we’ll send you a reset link.</p>' +
      '<label for="resetEmail" class="early-access-label" data-i18n="auth.emailLabel">Email</label>' +
      '<input type="email" id="resetEmail" class="early-access-input" autocomplete="username" placeholder="you@example.com" required />' +
      '<p class="auth-reset-status" id="resetStatus" role="status" hidden></p>' +
      '<button type="button" class="btn btn-primary early-access-submit js-auth-reset-submit" data-i18n="auth.resetSubmit">Send reset link</button>' +
      '<button type="button" class="btn btn-outline auth-reset-back js-auth-reset-back" data-i18n="auth.resetBack">Back to login</button>';

    var resetEmail = resetPanel.querySelector("#resetEmail");
    var resetSubmit = resetPanel.querySelector(".js-auth-reset-submit");
    var resetBack = resetPanel.querySelector(".js-auth-reset-back");

    if (resetSubmit) {
      resetSubmit.addEventListener("click", function () {
        submitPasswordReset(resetEmail, resetSubmit);
      });
    }

    if (resetBack) {
      resetBack.addEventListener("click", function (e) {
        e.preventDefault();
        showLoginView();
      });
    }

    panelLogin.appendChild(resetPanel);
    return resetPanel;
  }

  function setResetStatus(message, type) {
    var status = document.getElementById("resetStatus");
    if (!status) return;
    status.textContent = message || "";
    status.classList.remove("is-error", "is-success");
    if (type) status.classList.add(type);
    status.hidden = !message;
  }

  function showLoginView() {
    ensureForgotPasswordLink();
    if (loginForm) loginForm.hidden = false;
    if (resetPanel) resetPanel.hidden = true;
    if (authModalTitle) authModalTitle.textContent = tAuth("auth.title", "Log in or sign up");
    if (authModalSub) {
      authModalSub.hidden = false;
      authModalSub.textContent = tAuth("auth.sub", "Access your Kimure account or start registration.");
    }
    setResetStatus("");
  }

  function showResetPasswordView() {
    ensureResetPanel();
    if (loginForm) loginForm.hidden = true;
    if (resetPanel) resetPanel.hidden = false;
    clearLoginError();
    if (authModalTitle) authModalTitle.textContent = tAuth("auth.resetTitle", "Reset your password");
    if (authModalSub) authModalSub.hidden = true;

    var resetEmail = document.getElementById("resetEmail");
    if (resetEmail && loginEmail && loginEmail.value.trim()) {
      resetEmail.value = loginEmail.value.trim();
    }
    if (resetEmail) resetEmail.focus();
  }

  function submitPasswordReset(resetEmailInput, button) {
    var email = resetEmailInput && resetEmailInput.value ? resetEmailInput.value.trim() : "";
    setResetStatus("");

    if (!email) {
      setResetStatus(tAuth("auth.resetErrorGeneric", "Could not send reset email. Please try again."), "is-error");
      return;
    }

    if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.requestPasswordReset) {
      setResetStatus("Auth is not loaded on this page. Check that auth.js is included.", "is-error");
      return;
    }

    if (button) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = "Sending...";
    }

    window.KIMURE_AUTH.requestPasswordReset(email).then(function (result) {
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.originalText || tAuth("auth.resetSubmit", "Send reset link");
      }

      if (result.error) {
        setResetStatus(result.error.message, "is-error");
        return;
      }

      setResetStatus(tAuth("auth.resetSuccess", "Password reset email sent. Check your inbox."), "is-success");
    });
  }

  function showLoginTab() {
    if (tabLogin) {
      tabLogin.classList.add("is-active");
      tabLogin.setAttribute("aria-selected", "true");
    }
    if (tabSignUp) {
      tabSignUp.classList.remove("is-active");
      tabSignUp.setAttribute("aria-selected", "false");
    }
    if (panelLogin) {
      panelLogin.hidden = false;
    }
    if (panelSignUp) {
      panelSignUp.hidden = true;
    }
    showLoginView();
  }

  function showSignUpTab() {
    if (tabSignUp) {
      tabSignUp.classList.add("is-active");
      tabSignUp.setAttribute("aria-selected", "true");
    }
    if (tabLogin) {
      tabLogin.classList.remove("is-active");
      tabLogin.setAttribute("aria-selected", "false");
    }
    if (panelSignUp) {
      panelSignUp.hidden = false;
    }
    if (panelLogin) {
      panelLogin.hidden = true;
    }
  }

  function openModal() {
    if (!overlay) return;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    if (mainEl) mainEl.hidden = false;
    if (loginSuccessEl) loginSuccessEl.hidden = true;
    showLoginTab();
    if (loginForm) loginForm.reset();
    clearLoginError();
    showLoginView();
    if (loginEmail) loginEmail.focus();
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (!overlay) return;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (mainEl) mainEl.hidden = false;
    if (loginSuccessEl) loginSuccessEl.hidden = true;
    showLoginTab();
    if (loginForm) loginForm.reset();
    clearLoginError();
    showLoginView();
  }

  ensureForgotPasswordLink();

  document.querySelectorAll(".js-early-access").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      if (el.classList.contains("is-authenticated")) return;
      openModal();
    });
  });

  if (tabLogin) tabLogin.addEventListener("click", function () {
    if (loginSuccessEl && !loginSuccessEl.hidden) return;
    showLoginTab();
  });
  if (tabSignUp) tabSignUp.addEventListener("click", function () {
    if (loginSuccessEl && !loginSuccessEl.hidden) return;
    showSignUpTab();
  });

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (closeAfterBtn) closeAfterBtn.addEventListener("click", closeModal);

  if (overlay) {
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay && overlay.classList.contains("is-open")) closeModal();
  });

  if (loginForm && loginEmail && loginPassword && loginSuccessEl && mainEl) {
    var loginSubmitBtn = loginForm.querySelector('button[type="submit"]');

    loginEmail.addEventListener("input", clearLoginError);
    loginPassword.addEventListener("input", clearLoginError);

    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = (loginEmail.value || "").trim();
      var pass = loginPassword.value || "";
      clearLoginError();

      if (!email || !pass) {
        showLoginError(tAuth("auth.loginErrorInvalid", "Wrong email or password. Please try again."));
        return;
      }

      if (!window.KIMURE_AUTH || !window.KIMURE_AUTH.signIn) {
        showLoginError("Auth is not loaded on this page. Check that auth.js is included.");
        return;
      }

      if (loginSubmitBtn) {
        loginSubmitBtn.disabled = true;
        loginSubmitBtn.dataset.originalText = loginSubmitBtn.textContent;
        loginSubmitBtn.textContent = "Logging in...";
      }

      window.KIMURE_AUTH.signIn(email, pass).then(function (result) {
        if (loginSubmitBtn) {
          loginSubmitBtn.disabled = false;
          loginSubmitBtn.textContent = loginSubmitBtn.dataset.originalText || "Log in";
        }

        if (result.error) {
          showLoginError(formatLoginError(result.error));
          loginPassword.focus();
          return;
        }

        clearLoginError();
        mainEl.hidden = true;
        loginSuccessEl.hidden = false;
      });
    });
  }
})();

// Auth nav: show who is logged in, hide login CTAs, add Sign out
(function () {
  var signOutBtn = null;

  function t(key, fallback) {
    var d = window.KIMURE_I18N_DICT;
    return d && d[key] != null ? d[key] : fallback;
  }

  function getDisplayName(user) {
    if (!user) return "";
    if (user.user_metadata && user.user_metadata.full_name) {
      return user.user_metadata.full_name;
    }
    if (user.email) return user.email.split("@")[0];
    return "Account";
  }

  function ensureSignOutButton() {
    var navActions = document.querySelector(".nav-actions");
    if (!navActions) return null;
    if (signOutBtn) return signOutBtn;

    signOutBtn = document.createElement("button");
    signOutBtn.type = "button";
    signOutBtn.className = "btn btn-outline js-auth-sign-out";
    signOutBtn.setAttribute("data-i18n", "nav.signOut");
    signOutBtn.textContent = t("nav.signOut", "Sign out");
    signOutBtn.hidden = true;
    navActions.appendChild(signOutBtn);

    signOutBtn.addEventListener("click", function () {
      if (window.KIMURE_AUTH && window.KIMURE_AUTH.signOut) {
        window.KIMURE_AUTH.signOut();
      }
    });

    return signOutBtn;
  }

  function updateAuthUI(user) {
    var loginBtns = document.querySelectorAll(".js-early-access");
    var outBtn = ensureSignOutButton();

    loginBtns.forEach(function (btn) {
      if (user) {
        if (btn.closest(".nav-actions")) {
          btn.textContent = getDisplayName(user);
          btn.classList.add("is-authenticated");
          btn.classList.remove("btn-primary");
          btn.classList.add("btn-outline");
          btn.setAttribute("title", user.email || "");
        } else {
          btn.hidden = true;
        }
      } else {
        btn.hidden = false;
        btn.classList.remove("is-authenticated");
        if (btn.closest(".nav-actions")) {
          btn.classList.add("btn-primary");
          btn.classList.remove("btn-outline");
          var key = btn.getAttribute("data-i18n");
          btn.textContent = key ? t(key, btn.textContent) : btn.textContent;
          btn.removeAttribute("title");
        } else {
          var heroKey = btn.getAttribute("data-i18n");
          if (heroKey) btn.textContent = t(heroKey, btn.textContent);
        }
      }
    });

    if (outBtn) {
      outBtn.hidden = !user;
      outBtn.textContent = t("nav.signOut", "Sign out");
    }
  }

  document.addEventListener("kimure-auth-changed", function (e) {
    updateAuthUI(e.detail && e.detail.user ? e.detail.user : null);
  });

  document.addEventListener("kimure-i18n-applied", function () {
    if (window.KIMURE_AUTH && window.KIMURE_AUTH.getCurrentUser) {
      window.KIMURE_AUTH.getCurrentUser().then(updateAuthUI);
    }
  });

  if (window.KIMURE_AUTH && window.KIMURE_AUTH.getCurrentUser) {
    window.KIMURE_AUTH.getCurrentUser().then(updateAuthUI);
  }
})();