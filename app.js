// Amazon Flex — Gate & Locker Codes
// Displays entries grouped by HOA (group.community) and filtered by tabs + search.
// Adds a Google Maps "Street View" link for every entry (opens Maps search; Street View is available when Google has pano coverage).

const DATA_FILE = "data.json"; // <-- change if your JSON filename differs
const DEFAULT_TAB = "apartments";

const $ = (sel) => document.querySelector(sel);

const els = {
  search: $("#search"),
  list: $("#list"),
  summary: $("#summary"),
  toast: $("#toast"),
  tabs: Array.from(document.querySelectorAll(".tab")),
};

let rawGroups = [];
let activeTab = DEFAULT_TAB;

// ---------- helpers ----------
function normalize(str) {
  return (str ?? "").toString().trim().toLowerCase();
}

function safeText(str) {
  return (str ?? "").toString();
}

function toast(msg) {
  if (!els.toast) return;
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.remove("show"), 1600);
}

function buildMapsQuery(entry, group) {
  const parts = [];
  const addr = safeText(entry.address);
  if (addr) parts.push(addr);

  const apt = safeText(entry.apartment);
  if (apt && !parts.join(' ').toLowerCase().includes(apt.toLowerCase())) parts.push(apt);

  const city = safeText(entry.city) || safeText(group.region) || 'Tucson';
  if (city) parts.push(city);

  const joined = parts.join(', ');
  return joined.toLowerCase().includes('az') ? joined : `${joined}, AZ`;
}

function getLatLng(entry) {
  const lat = parseFloat(entry.lat ?? entry.latitude ?? entry.y ?? '');
  const lng = parseFloat(entry.lng ?? entry.lon ?? entry.longitude ?? entry.x ?? '');
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

function streetViewUrl(entry, group) {
  const ll = getLatLng(entry);
  if (ll) {
    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ll.lat},${ll.lng}`;
  }
  const query = buildMapsQuery(entry, group);
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&layer=c`;
}


function entryMatchesTab(entry, tab) {
  const t = normalize(entry.type);
  if (tab === "all") return true;

  if (tab === "apartments") return t === "apartment";
  if (tab === "residential") return t === "residential";
  if (tab === "businesses") return t === "business";

  return true;
}

function entryMatchesSearch(entry, group, q) {
  if (!q) return true;
  const hay = [
    group.community,              // HOA name
    group.region,
    entry.address,
    entry.gate,
    entry.alternate,
    entry.locker,
    entry.apartment,
    entry.business,
    entry.city,
    entry.type,
  ].map(normalize).join(" | ");

  return hay.includes(q);
}

// ---------- rendering ----------
function render() {
  const q = normalize(els.search?.value);
  const groups = rawGroups;

  const filtered = [];
  let groupCount = 0;
  let entryCount = 0;

  for (const group of groups) {
    const hoa = safeText(group.community); // HOA = community
    const addresses = Array.isArray(group.addresses) ? group.addresses : [];

    const hits = addresses.filter((entry) => (
      entryMatchesTab(entry, activeTab) && entryMatchesSearch(entry, group, q)
    ));

    if (hits.length) {
      filtered.push({ group, hits, hoa });
      groupCount += 1;
      entryCount += hits.length;
    }
  }

  if (els.summary) {
    const tabLabel =
      activeTab === "apartments" ? "Apartments" :
      activeTab === "residential" ? "Residential" :
      activeTab === "businesses" ? "Businesses" : "All";

    els.summary.textContent = `${tabLabel}: ${entryCount} entr${entryCount === 1 ? "y" : "ies"} in ${groupCount} HOA${groupCount === 1 ? "" : "s"}`;
  }

  if (!els.list) return;
  els.list.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No matches. Try a different search or tab.";
    els.list.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();

  for (const { group, hits, hoa } of filtered) {
    const section = document.createElement("section");
    section.className = "community";

    const h2 = document.createElement("h2");
    h2.textContent = hoa || "(Unnamed HOA)";
    section.appendChild(h2);

    if (safeText(group.description)) {
      const p = document.createElement("p");
      p.className = "desc";
      p.textContent = safeText(group.description);
      section.appendChild(p);
    }

    for (const entry of hits) {
      const card = document.createElement("article");
      card.className = `card type-${normalize(entry.type) || "unknown"}`;

      const addr = document.createElement("div");
      addr.className = "addr";
      addr.textContent = safeText(entry.address) || "(No address)";
      card.appendChild(addr);

      const meta = document.createElement("div");
      meta.className = "meta";

      const type = safeText(entry.type);
      if (type) {
        const pill = document.createElement("span");
        pill.className = "pill";
        pill.textContent = type;
        meta.appendChild(pill);
      }

      const city = safeText(entry.city);
      if (city) {
        const c = document.createElement("span");
        c.className = "meta-item";
        c.textContent = city;
        meta.appendChild(c);
      }

      card.appendChild(meta);

      const rows = document.createElement("div");
      rows.className = "rows";

      function addRow(label, value) {
        const v = safeText(value);
        if (!v) return;
        const row = document.createElement("div");
        row.className = "row";
        const l = document.createElement("span");
        l.className = "label";
        l.textContent = label;
        const val = document.createElement("span");
        val.className = "value";
        val.textContent = v;
        row.appendChild(l);
        row.appendChild(val);
        rows.appendChild(row);
      }

      addRow("Gate", entry.gate);
      addRow("Alt", entry.alternate);
      addRow("Locker", entry.locker);
      addRow("Apartment", entry.apartment);
      addRow("Business", entry.business);

      if (rows.childElementCount) card.appendChild(rows);

      const actions = document.createElement("div");
      actions.className = "actions";

      const maps = document.createElement("a");
      maps.href = streetViewUrl(entry, group);
      maps.target = "_blank";
      maps.rel = "noopener noreferrer";
      maps.className = "btn";
      maps.textContent = "Street View";
      actions.appendChild(maps);

      const gateVal = safeText(entry.gate);
      if (gateVal) {
        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "btn secondary";
        copy.textContent = "Copy Gate";
        copy.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(gateVal);
            toast(`Copied: ${gateVal}`);
          } catch {
            const ta = document.createElement("textarea");
            ta.value = gateVal;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
            toast(`Copied: ${gateVal}`);
          }
        });
        actions.appendChild(copy);
      }

      card.appendChild(actions);
      section.appendChild(card);
    }

    frag.appendChild(section);
  }

  els.list.appendChild(frag);
}

// ---------- tabs ----------
function setActiveTab(tab) {
  activeTab = tab;

  for (const btn of els.tabs) {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  }

  render();
}

// ---------- init ----------
async function init() {
  for (const btn of els.tabs) {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  }

  if (els.search) {
    els.search.addEventListener("input", () => render());
  }

  try {
    const res = await fetch(DATA_FILE, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("JSON root is not an array");

    rawGroups = data;
    setActiveTab(activeTab);
  } catch (err) {
    console.error(err);
    if (els.summary) els.summary.textContent = "Error loading data.";
    if (els.list) {
      els.list.innerHTML = `<div class="empty">Could not load <b>${DATA_FILE}</b>. Check filename/path and JSON format.</div>`;
    }
  }
}

init();
