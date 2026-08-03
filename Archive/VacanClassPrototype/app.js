// =========================================================================
// 1. DATA CONFIGURATION
// =========================================================================
const SCHOOLS_DATABASE = [
    { 
        id: "ZA-7001", isPremium: true, name: "Bedfordview Primary School", 
        lat: -26.1780, lng: 28.1310, address: "1 School Rd, Bedfordview, Germiston", 
        sector: "public", level: "Public Primary School", contact: "+27 11 555 0192", 
        email: "admissions@bedfordviewprimary.co.za", image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=500", 
        capacities: [ { label: "Grade R", status: "5 Left", isFull: false }, { label: "Grade 1", status: "10 Left", isFull: false }, { label: "Grade 2", status: "Full", isFull: true } ],
        description: "Leading primary institution offering holistic learning."
    },
    { 
        id: "ZA-7002", isPremium: false, name: "St Benedict's College", 
        lat: -26.1690, lng: 28.1340, address: "36 Harcus Rd, Bedfordview, Germiston", 
        sector: "private", level: "Independent Boys School", contact: "+27 11 555 0195", 
        email: "info@stbenedicts.co.za", image: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=500", 
        capacities: [ { label: "Grade 8", status: "2 Left", isFull: false } ],
        description: "Independent Catholic school known for academic rigor."
    },
    { 
        id: "ZA-7003", isPremium: false, name: "Germiston High School", 
        lat: -26.2210, lng: 28.1740, address: "10 Cnr Radnor & Cross Rd, Germiston", 
        sector: "public", level: "Public High School", contact: "+27 11 555 0241", 
        email: "admin@germistonhigh.co.za", image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=500", 
        capacities: [ { label: "Grade 8", status: "Full", isFull: true } ],
        description: "Historic public high school serving the broader Ekurhuleni district."
    }
];

let map;
let markersLayer;
let defaultCenter = [-26.1750, 28.1400];
let activeUserCoords = null;

// =========================================================================
// 2. INITIALIZATION
// =========================================================================
function googleTranslateElementInit() {
    new google.translate.TranslateElement({ pageLanguage: 'en', layout: google.translate.TranslateElement.InlineLayout.SIMPLE }, 'google_translate_element');
}

document.addEventListener("DOMContentLoaded", () => {
    // Only initialize map if the map container exists (prevents errors on institution.html)
    if (document.getElementById('map')) {
        initMapEngine();
    }
    checkDisclaimerConsent();
    loadSavedUserPreferences();
    bindUIPipelineEvents();
    bindMobileNavigation();
});

function initMapEngine() {
    map = L.map('map').setView(defaultCenter, 12);
    markersLayer = L.layerGroup().addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    setTimeout(() => { map.invalidateSize(); }, 400);
    evaluateAndRenderListings(SCHOOLS_DATABASE);
}

function checkDisclaimerConsent() {
    if (!localStorage.getItem("vacanclass_consent") && document.getElementById("disclaimerModal")) {
        openModal("disclaimerModal");
    }
}

function loadSavedUserPreferences() {
    try {
        const savedLoc = localStorage.getItem("vacanclass_saved_location");
        if (savedLoc && document.getElementById("savedLocationBar")) {
            const data = JSON.parse(savedLoc);
            activeUserCoords = data.coords;
            document.getElementById("savedAddressLabel").textContent = data.address;
            document.getElementById("savedLocationBar").classList.remove("hidden");
            if (map) map.setView(activeUserCoords, 13);
            evaluateAndRenderListings(SCHOOLS_DATABASE, activeUserCoords);
        }
    } catch(e) { console.error("LocalStorage read error"); }
}

// =========================================================================
// 3. GEOCODING & RENDERING
// =========================================================================
async function executeAddressLookup(queryText) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(queryText)}`);
        const data = await response.json();
        if (data && data.length > 0) return { coords: [parseFloat(data[0].lat), parseFloat(data[0].lon)], address: data[0].display_name, success: true };
    } catch (err) { console.error("Geocode failed", err); }
    return { coords: defaultCenter, address: queryText, success: false };
}

function calculateDistanceKM(lat1, lon1, lat2, lon2) {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return 2 * R * Math.asin(Math.sqrt(a));
}

function evaluateAndRenderListings(records, userCoords = activeUserCoords) {
    const container = document.getElementById("schoolsListContainer");
    if (!container) return;
    container.innerHTML = "";
    if (markersLayer) markersLayer.clearLayers();

    records.forEach(s => s.calculatedDistance = userCoords ? calculateDistanceKM(userCoords[0], userCoords[1], s.lat, s.lng) : 9999);
    
    const sortedDataset = [
        ...records.filter(s => s.isPremium).sort((a, b) => a.calculatedDistance - b.calculatedDistance),
        ...records.filter(s => !s.isPremium).sort((a, b) => a.calculatedDistance - b.calculatedDistance)
    ];

    document.getElementById("schoolsCountBadge").textContent = `${sortedDataset.length} Found`;
    document.getElementById("mobileCount").textContent = sortedDataset.length;

    if (userCoords && map) L.circleMarker(userCoords, { color: '#d97706', fillColor: '#f59e0b', fillOpacity: 0.9, radius: 8 }).addTo(markersLayer);

    sortedDataset.forEach(school => {
        const distText = school.calculatedDistance < 9000 ? `${school.calculatedDistance.toFixed(1)} km away` : "Distance unknown";
        if (map) L.marker([school.lat, school.lng]).addTo(markersLayer).bindPopup(`<b>${school.name}</b><br>${school.address}`);
        
        const card = document.createElement("div");
        card.className = `school-list-card ${school.isPremium ? 'featured-card' : ''}`;
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="card-distance">${distText}</span> ${school.isPremium ? '<span class="featured-badge">⭐ Featured</span>' : ''}
            </div>
            <div class="card-title-stack" style="margin-top:6px;">
                <h3 style="font-size: 16px;">${school.name}</h3><div style="font-size:12px; color:var(--muted-text);">${school.level}</div>
            </div>
            <div class="card-address">📍 ${school.address}</div>
            <div class="capacity-grid">${school.capacities.map(c => `<span class="capacity-box ${c.isFull ? 'full' : 'available'}">${c.label}: ${c.status}</span>`).join('')}</div>
        `;
        card.addEventListener("click", () => openSchoolDetailModal(school));
        container.appendChild(card);
    });
}

// =========================================================================
// 4. ROBUST MODAL & EVENT PIPELINE
// =========================================================================
function openModal(id) {
    document.getElementById("modalOverlay").style.display = "flex";
    document.querySelectorAll(".modal-card").forEach(m => m.style.display = "none");
    document.getElementById(id).style.display = "block";
}

function closeAllModals() {
    if (document.getElementById("modalOverlay")) {
        document.getElementById("modalOverlay").style.display = "none";
        document.querySelectorAll(".modal-card").forEach(m => m.style.display = "none");
    }
}

function openSchoolDetailModal(school) {
    document.getElementById("schoolDetailContent").innerHTML = `
        <img src="${school.image}" alt="${school.name}" style="width:100%; height:220px; object-fit:cover; border-radius:8px;">
        <h2 style="margin-top:16px;">${school.name} ${school.isPremium ? '⭐' : ''}</h2>
        <p style="color:var(--muted-text); font-size:14px; margin-bottom: 12px;">${school.level} &bull; ${school.sector.toUpperCase()}</p>
        <p><b>📍 Address:</b> ${school.address}</p>
        <p style="margin-top:12px; line-height: 1.5;">${school.description}</p>
        
        <h4 style="margin-top:20px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">Live Class Capacity</h4>
        <div class="capacity-grid" style="margin-top:10px;">
            ${school.capacities.map(c => `<span class="capacity-box ${c.isFull ? 'full' : 'available'}" style="font-size:13px; padding:6px 10px;">${c.label}: ${c.status}</span>`).join('')}
        </div>
        
        <div style="margin-top:24px; display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn premium-btn" style="flex: 1;" onclick="alert('Redirecting to the VacanClass Verified Application Portal...')">✅ Apply & Verify Portal</button>
            <a href="tel:${school.contact}" class="btn school-tier-btn" style="text-decoration:none;">📞 Call</a>
            <a href="mailto:${school.email}" class="btn btn-search" style="text-decoration:none;">✉️ Email</a>
        </div>
    `;
    openModal("schoolDetailModal");
}

function bindUIPipelineEvents() {
    // Modal Closing
    document.querySelectorAll(".modal-close-btn").forEach(btn => btn.addEventListener("click", closeAllModals));
    const overlay = document.getElementById("modalOverlay");
    if (overlay) overlay.addEventListener("click", (e) => { if (e.target.id === "modalOverlay") closeAllModals(); });
    
    // Help & Report Modals
    document.getElementById("helpBtn")?.addEventListener("click", () => openModal("helpModal"));
    document.getElementById("reportBtn")?.addEventListener("click", () => openModal("reportModal"));

    // Accept Disclaimer
    document.getElementById("acceptDisclaimerBtn")?.addEventListener("click", () => {
        localStorage.setItem("vacanclass_consent", "true");
        closeAllModals();
    });

    // Pricing Triggers
    document.getElementById("premiumParentBtn")?.addEventListener("click", () => openModal("parentPricingModal"));
    document.getElementById("premiumSchoolBtn")?.addEventListener("click", () => openModal("schoolPricingModal"));

    // Footer Prompts
    document.getElementById("footerPrivacy")?.addEventListener("click", (e) => { e.preventDefault(); alert("VacanClass Privacy Policy:\n\nWe encrypt all parent searches and do not sell location data to third parties. Verified portals process data securely."); });
    document.getElementById("footerTerms")?.addEventListener("click", (e) => { e.preventDefault(); alert("Terms of Service:\n\nBy using VacanClass, you agree to verified, truthful application submissions and respect institutional property mapping."); });
    document.getElementById("footerSafety")?.addEventListener("click", (e) => { e.preventDefault(); alert("🛡️ Child Safety Protocol Activated:\n\nAll institutions on this map are verified. Automated scraping of locations or capacities is actively monitored and blocked to protect minors."); });

    // Search Logic
    document.getElementById("searchBtn")?.addEventListener("click", async () => {
        const val = document.getElementById("addressInput").value.trim();
        if (val) {
            document.getElementById("searchBtn").textContent = "...";
            const result = await executeAddressLookup(val);
            if (result.success) {
                activeUserCoords = result.coords;
                map.setView(result.coords, 14);
                evaluateAndRenderListings(SCHOOLS_DATABASE, result.coords);
            }
            document.getElementById("searchBtn").textContent = "Search";
        }
    });

    // Save Location Logic
    document.getElementById("saveLocationBtn")?.addEventListener("click", () => {
        if (activeUserCoords) {
            const val = document.getElementById("addressInput").value.trim() || "Saved Location";
            localStorage.setItem("vacanclass_saved_location", JSON.stringify({ address: val, coords: activeUserCoords }));
            document.getElementById("savedAddressLabel").textContent = val;
            document.getElementById("savedLocationBar").classList.remove("hidden");
            alert("✅ Location saved to VacanClass Watchlist!");
        } else alert("Please run a search or use Live Location first.");
    });

    document.getElementById("clearSavedLocBtn")?.addEventListener("click", () => {
        localStorage.removeItem("vacanclass_saved_location");
        document.getElementById("savedLocationBar").classList.add("hidden");
    });

    // Live Location
    document.getElementById("liveLocationBtn")?.addEventListener("click", () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                activeUserCoords = [pos.coords.latitude, pos.coords.longitude];
                map.setView(activeUserCoords, 14);
                evaluateAndRenderListings(SCHOOLS_DATABASE, activeUserCoords);
            });
        }
    });

    // Theme Toggle
    document.getElementById("themeToggle")?.addEventListener("click", () => {
        document.body.classList.toggle("dark-theme");
        const isDark = document.body.classList.contains("dark-theme");
        updateThemeLogos(isDark);
    });
}

function bindMobileNavigation() {
    const tabs = { tabMap: "mapContainer", tabList: "sidebarRight", tabSearch: "sidebarLeft" };
    Object.keys(tabs).forEach(tabId => {
        const btn = document.getElementById(tabId);
        if (btn) {
            btn.addEventListener("click", (e) => {
                document.querySelectorAll(".mobile-tab").forEach(t => t.classList.remove("active"));
                document.querySelectorAll(".mobile-view-panel").forEach(p => p.classList.remove("active-mobile-view"));
                
                e.target.closest('.mobile-tab').classList.add("active");
                document.getElementById(tabs[tabId]).classList.add("active-mobile-view");
                
                if (tabId === "tabMap" && map) setTimeout(() => map.invalidateSize(), 150);
            });
        }
    });
}

// =========================================================================
// THEME LOGO SWITCHER (Cleaned File Paths)
// =========================================================================
function updateThemeLogos(isDark) {
    const logoSrc = isDark ? "NightLogo.png" : "DayLogo.png";
    const headerLogo = document.getElementById("headerLogoImg");
    const favicon = document.getElementById("appFavicon");

    if (headerLogo) headerLogo.src = logoSrc;
    if (favicon) favicon.href = logoSrc;
}

// =========================================================================
// INSTITUTION PORTAL TAB LOGIC
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    const tabLogin = document.getElementById("tabLogin");
    const tabRegister = document.getElementById("tabRegister");
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    if (tabLogin && tabRegister && loginForm && registerForm) {
        tabLogin.addEventListener("click", () => {
            tabLogin.classList.add("active");
            tabRegister.classList.remove("active");
            loginForm.classList.remove("hidden");
            registerForm.classList.add("hidden");
        });

        tabRegister.addEventListener("click", () => {
            tabRegister.classList.add("active");
            tabLogin.classList.remove("active");
            registerForm.classList.remove("hidden");
            loginForm.classList.add("hidden");
        });
    }
});
