/* =========================================================
   NYC Room Classifier – frontend logic
   ========================================================= */

const DEFAULT_API = "http://127.0.0.1:8000";
let API_URL = (() => {
  try { return localStorage.getItem("nyc_api_url") || DEFAULT_API; } catch { return DEFAULT_API; }
})();

const $ = (id) => document.getElementById(id);
const FIELDS = [
  "latitude", "longitude", "price", "minimum_nights", "number_of_reviews",
  "reviews_per_month", "calculated_host_listings_count", "availability_365",
  "neighbourhood_group", "neighbourhood",
];

/* The API returns probabilities without class names. scikit-learn sorts
   classes alphabetically, so we map by position. Adjust if your labels differ. */
const CLASSES_3 = ["Entire home/apt", "Private room", "Shared room"];
const CLASSES_4 = ["Entire home/apt", "Hotel room", "Private room", "Shared room"];

const ROOM_META = {
  "Entire home/apt": { icon: "🏢", desc: "A whole place to yourself: privacy, kitchen and space." },
  "Private room":    { icon: "🛏️", desc: "Your own room inside a shared home or apartment." },
  "Shared room":     { icon: "👥", desc: "A shared sleeping space, usually the budget pick." },
  "Hotel room":      { icon: "🏨", desc: "A hotel-style room with service and amenities." },
};

const HOODS = {
  "Manhattan": ["Harlem", "East Village", "Upper West Side", "Upper East Side", "Midtown", "Chelsea", "Hell's Kitchen", "Lower East Side", "Washington Heights", "West Village", "Greenwich Village", "SoHo", "Chinatown"],
  "Brooklyn": ["Williamsburg", "Bedford-Stuyvesant", "Bushwick", "Crown Heights", "Greenpoint", "Park Slope", "Flatbush", "Fort Greene", "Sunset Park", "Brooklyn Heights"],
  "Queens": ["Astoria", "Long Island City", "Flushing", "Ridgewood", "Jamaica", "Sunnyside", "Forest Hills", "Elmhurst"],
  "Bronx": ["Mott Haven", "Fordham", "Concourse", "Kingsbridge", "Riverdale", "Woodlawn"],
  "Staten Island": ["St. George", "Tompkinsville", "Stapleton", "New Brighton"],
};

const PRESETS = {
  manhattan: { neighbourhood_group: "Manhattan", neighbourhood: "Harlem", latitude: 40.8116, longitude: -73.9465, price: 180, minimum_nights: 2, number_of_reviews: 48, reviews_per_month: 1.4, calculated_host_listings_count: 1, availability_365: 220 },
  brooklyn:  { neighbourhood_group: "Brooklyn", neighbourhood: "Bedford-Stuyvesant", latitude: 40.6872, longitude: -73.9418, price: 65, minimum_nights: 1, number_of_reviews: 90, reviews_per_month: 2.1, calculated_host_listings_count: 2, availability_365: 300 },
  queens:    { neighbourhood_group: "Queens", neighbourhood: "Astoria", latitude: 40.7644, longitude: -73.9235, price: 40, minimum_nights: 3, number_of_reviews: 12, reviews_per_month: 0.6, calculated_host_listings_count: 4, availability_365: 340 },
};

/* ---------------- Toast ---------------- */
let toastTimer;
function toast(msg, type = "") {
  const t = $("toast");
  t.textContent = msg;
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 3500);
}

/* ---------------- Particle background ---------------- */
(function particles() {
  const c = $("bg");
  const ctx = c.getContext("2d");
  let w, h, pts;
  const mouse = { x: -999, y: -999 };

  function resize() {
    w = c.width = window.innerWidth;
    h = c.height = window.innerHeight;
    const n = Math.min(90, Math.floor((w * h) / 18000));
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.6 + 0.4,
    }));
  }
  window.addEventListener("resize", resize);
  window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
  resize();

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(160,150,255,.7)";
      ctx.fill();
    }
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 120) {
          ctx.strokeStyle = `rgba(124,92,255,${0.16 * (1 - d / 120)})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      const m = Math.hypot(pts[i].x - mouse.x, pts[i].y - mouse.y);
      if (m < 150) {
        ctx.strokeStyle = `rgba(34,211,238,${0.35 * (1 - m / 150)})`;
        ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      }
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  frame();
})();

/* ---------------- API status ---------------- */
async function checkApi() {
  const s = $("status"), txt = $("statusText");
  s.className = "status checking"; txt.textContent = "Checking API…";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(API_URL + "/", { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error();
    s.className = "status online"; txt.textContent = "API online";
  } catch {
    s.className = "status offline"; txt.textContent = "API offline";
  }
}

$("apiBtn").addEventListener("click", () => {
  const v = prompt("FastAPI base URL:", API_URL);
  if (!v) return;
  API_URL = v.trim().replace(/\/+$/, "");
  try { localStorage.setItem("nyc_api_url", API_URL); } catch {}
  toast("API URL saved", "ok");
  checkApi();
});
$("status").addEventListener("click", checkApi);

/* ---------------- Form helpers ---------------- */
function fillHoods() {
  const g = $("neighbourhood_group").value;
  $("hoods").innerHTML = (HOODS[g] || Object.values(HOODS).flat())
    .map((n) => `<option value="${n}">`).join("");
}
$("neighbourhood_group").addEventListener("change", fillHoods);
fillHoods();

function updateAvail() {
  const v = +$("availability_365").value;
  $("availOut").textContent = v;
  $("availFill").style.width = (v / 365) * 100 + "%";
}
$("availability_365").addEventListener("input", updateAvail);
updateAvail();

document.querySelectorAll(".stepper button").forEach((b) => {
  b.addEventListener("click", () => {
    const input = $(b.parentElement.dataset.for);
    const next = (+input.value || 1) + +b.dataset.dir;
    input.value = Math.min(365, Math.max(1, next));
    input.dispatchEvent(new Event("input"));
  });
});

function setValues(data) {
  FIELDS.forEach((k) => {
    if (data[k] !== undefined) $(k).value = data[k];
  });
  fillHoods();
  updateAvail();
  document.querySelectorAll(".field.invalid").forEach((f) => f.classList.remove("invalid"));
}

document.querySelectorAll("[data-preset]").forEach((b) => {
  b.addEventListener("click", () => {
    const key = b.dataset.preset;
    if (key === "random") {
      const groups = Object.keys(HOODS);
      const g = groups[Math.floor(Math.random() * groups.length)];
      const list = HOODS[g];
      const rnd = (a, b, d = 0) => +(a + Math.random() * (b - a)).toFixed(d);
      setValues({
        neighbourhood_group: g,
        neighbourhood: list[Math.floor(Math.random() * list.length)],
        latitude: rnd(40.55, 40.9, 4), longitude: rnd(-74.1, -73.75, 4),
        price: rnd(25, 400), minimum_nights: rnd(1, 14),
        number_of_reviews: rnd(0, 250), reviews_per_month: rnd(0, 5, 2),
        calculated_host_listings_count: rnd(1, 20), availability_365: rnd(0, 365),
      });
    } else {
      setValues(PRESETS[key]);
    }
    toast("Example loaded – hit Predict!");
  });
});

$("resetBtn").addEventListener("click", () => {
  $("form").reset();
  $("minimum_nights").value = 1;
  $("availability_365").value = 180;
  fillHoods(); updateAvail();
  document.querySelectorAll(".field.invalid").forEach((f) => f.classList.remove("invalid"));
  $("result").classList.add("hidden");
  $("empty").classList.remove("hidden");
});

/* ---------------- Validation ---------------- */
const RULES = {
  latitude:  { min: -90, max: 90, label: "Latitude" },
  longitude: { min: -180, max: 180, label: "Longitude" },
  price:     { gt: 0, label: "Price" },
  minimum_nights: { min: 1, max: 365, int: true, label: "Minimum nights" },
  number_of_reviews: { min: 0, int: true, label: "Reviews" },
  reviews_per_month: { min: 0, label: "Reviews per month" },
  calculated_host_listings_count: { min: 0, int: true, label: "Host listings" },
  availability_365: { min: 0, max: 365, int: true, label: "Availability" },
};

function validate() {
  let ok = true;
  FIELDS.forEach((k) => {
    const el = $(k);
    const wrap = el.closest(".field");
    const err = wrap ? wrap.querySelector(".err") : null;
    const v = el.value.trim();
    let msg = "";

    if (k === "neighbourhood_group" || k === "neighbourhood") {
      if (!v) msg = "This field is required";
    } else {
      const r = RULES[k];
      const n = Number(v);
      if (v === "" || Number.isNaN(n)) msg = "Enter a number";
      else if (r.gt !== undefined && n <= r.gt) msg = `${r.label} must be greater than ${r.gt}`;
      else if (r.min !== undefined && n < r.min) msg = `Minimum is ${r.min}`;
      else if (r.max !== undefined && n > r.max) msg = `Maximum is ${r.max}`;
      else if (r.int && !Number.isInteger(n)) msg = "Must be a whole number";
    }

    if (wrap) {
      wrap.classList.toggle("invalid", !!msg);
      if (err) err.textContent = msg;
    }
    if (msg) ok = false;
  });
  return ok;
}

FIELDS.forEach((k) => {
  const el = $(k);
  el.addEventListener("input", () => {
    const wrap = el.closest(".field");
    if (wrap && wrap.classList.contains("invalid")) wrap.classList.remove("invalid");
  });
});

/* ---------------- Ripple on primary button ---------------- */
$("submitBtn").addEventListener("pointerdown", (e) => {
  const b = e.currentTarget, r = b.getBoundingClientRect();
  const s = document.createElement("span");
  s.className = "ripple";
  const size = Math.max(r.width, r.height);
  s.style.width = s.style.height = size + "px";
  s.style.left = e.clientX - r.left - size / 2 + "px";
  s.style.top = e.clientY - r.top - size / 2 + "px";
  b.appendChild(s);
  setTimeout(() => s.remove(), 600);
});

/* ---------------- Submit & render ---------------- */
let history = [];
try { history = JSON.parse(localStorage.getItem("nyc_history") || "[]"); } catch {}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validate()) {
    toast("Please fix the highlighted fields", "error");
    return;
  }

  const payload = {
    latitude: +$("latitude").value,
    longitude: +$("longitude").value,
    price: +$("price").value,
    minimum_nights: +$("minimum_nights").value,
    number_of_reviews: +$("number_of_reviews").value,
    reviews_per_month: +$("reviews_per_month").value,
    calculated_host_listings_count: +$("calculated_host_listings_count").value,
    availability_365: +$("availability_365").value,
    neighbourhood_group: $("neighbourhood_group").value,
    neighbourhood: $("neighbourhood").value.trim(),
  };

  const btn = $("submitBtn");
  btn.disabled = true; btn.classList.add("loading");
  $("submitBtn").querySelector(".btn-label").textContent = "Predicting…";

  try {
    const res = await fetch(API_URL + "/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let detail = `Server error (${res.status})`;
      try {
        const j = await res.json();
        if (Array.isArray(j.detail)) detail = j.detail.map((d) => `${d.loc.slice(-1)}: ${d.msg}`).join("; ");
        else if (j.detail) detail = j.detail;
      } catch {}
      throw new Error(detail);
    }
    const data = await res.json();
    renderResult(data, payload);
    $("status").className = "status online";
    $("statusText").textContent = "API online";
  } catch (err) {
    const offline = err instanceof TypeError;
    toast(offline ? "Cannot reach the API. Is the server running?" : err.message, "error");
    if (offline) { $("status").className = "status offline"; $("statusText").textContent = "API offline"; }
  } finally {
    btn.disabled = false; btn.classList.remove("loading");
    $("submitBtn").querySelector(".btn-label").textContent = "Predict room type";
  }
});

function labelsFor(n, predicted) {
  let labels = n === 4 ? CLASSES_4 : n === 3 ? CLASSES_3 : null;
  if (!labels || (predicted && !labels.includes(predicted))) {
    labels = Array.from({ length: n }, (_, i) => `Class ${i + 1}`);
    if (predicted) labels[0] = predicted; // best effort fallback
  }
  return labels;
}

function animateNumber(el, to, ms = 1100) {
  const start = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - start) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = (to * eased).toFixed(1) + "%";
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderResult(data, payload) {
  const predicted = data.Predicted_room_type;
  const probs = data.Probability || [];
  const labels = labelsFor(probs.length, predicted);

  const idx = labels.indexOf(predicted);
  const topIdx = idx >= 0 ? idx : probs.indexOf(Math.max(...probs));
  const conf = (probs[topIdx] ?? 0) * 100;
  const meta = ROOM_META[predicted] || { icon: "🏠", desc: "" };

  $("empty").classList.add("hidden");
  const box = $("result");
  box.classList.remove("hidden");
  // restart pop animation
  box.style.animation = "none"; void box.offsetWidth; box.style.animation = "";

  $("roomType").textContent = predicted;
  $("roomIcon").textContent = meta.icon;
  $("roomDesc").textContent = meta.desc;

  // ring
  const ring = $("ringFg");
  const C = 2 * Math.PI * 52;
  ring.style.transition = "none";
  ring.style.strokeDashoffset = C;
  void ring.getBoundingClientRect();
  ring.style.transition = "";
  requestAnimationFrame(() => (ring.style.strokeDashoffset = C * (1 - conf / 100)));
  animateNumber($("confidence"), conf);

  // bars
  const order = probs.map((p, i) => ({ p, label: labels[i], i })).sort((a, b) => b.p - a.p);
  $("bars").innerHTML = order.map((o) => `
    <div class="bar-row ${o.i === topIdx ? "top" : ""}">
      <span>${o.label}</span><span class="pct">${(o.p * 100).toFixed(1)}%</span>
      <div class="track"><div class="fill" data-w="${(o.p * 100).toFixed(1)}"></div></div>
    </div>`).join("");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll("#bars .fill").forEach((f) => (f.style.width = f.dataset.w + "%"));
  }));

  if (conf >= 80) confetti();

  // history
  history.unshift({ predicted, conf, icon: meta.icon, payload, t: Date.now() });
  history = history.slice(0, 8);
  try { localStorage.setItem("nyc_history", JSON.stringify(history)); } catch {}
  renderHistory();

  if (window.innerWidth <= 920) $("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderHistory() {
  const ul = $("history");
  if (!history.length) {
    ul.innerHTML = '<li class="muted small">No predictions yet.</li>';
    return;
  }
  ul.innerHTML = history.map((h, i) => `
    <li data-i="${i}" title="Click to reload these inputs">
      <span class="h-icon">${h.icon}</span>
      <div class="h-main"><b>${h.predicted}</b>
        <span>${h.payload.neighbourhood}, ${h.payload.neighbourhood_group} · $${h.payload.price}</span></div>
      <span class="h-pct">${h.conf.toFixed(0)}%</span>
    </li>`).join("");
}
$("history").addEventListener("click", (e) => {
  const li = e.target.closest("li[data-i]");
  if (!li) return;
  setValues(history[+li.dataset.i].payload);
  toast("Inputs restored");
  $("formCard").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("clearHistory").addEventListener("click", () => {
  history = [];
  try { localStorage.removeItem("nyc_history"); } catch {}
  renderHistory();
});

/* ---------------- Confetti burst ---------------- */
function confetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  Object.assign(c.style, { position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 20, pointerEvents: "none" });
  c.width = innerWidth; c.height = innerHeight;
  document.body.appendChild(c);
  const ctx = c.getContext("2d");
  const colors = ["#7c5cff", "#22d3ee", "#34d399", "#fbbf24", "#f472b6"];
  const r = $("ringFg").getBoundingClientRect();
  const ox = r.left + r.width / 2, oy = r.top + r.height / 2;
  const ps = Array.from({ length: 90 }, () => {
    const a = Math.random() * Math.PI * 2, s = Math.random() * 7 + 3;
    return { x: ox, y: oy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, g: 0.18, w: Math.random() * 7 + 3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, col: colors[(Math.random() * colors.length) | 0], life: 1 };
  });
  (function tick() {
    ctx.clearRect(0, 0, c.width, c.height);
    let alive = false;
    for (const p of ps) {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 0.012;
      if (p.life <= 0) continue;
      alive = true;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(p.life, 0); ctx.fillStyle = p.col;
      ctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); ctx.restore();
    }
    if (alive) requestAnimationFrame(tick); else c.remove();
  })();
}

/* ---------------- Init ---------------- */
renderHistory();
checkApi();
