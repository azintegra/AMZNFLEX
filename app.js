/*
  Amazon Flex — Gate & Locker Codes
  UI goals:
  - Group list (collapsed by default) with count badge + chevron
  - Expanded group shows entry cards that match the original "clean" layout
  - Buttons: Maps + Street View stacked vertically
  - No extra "city" line inside entry cards (still searchable)
*/

const DATA_URL = "./data.json";

const $ = (id) => document.getElementById(id);

const state = {
  allGroups: [],
  activeTab: "apartments", // apartments | residential | businesses | all
  query: "",
  expandedGroups: new Set(), // key = `${tab}|${community}`
};

function normalize(s) {
  return (s ?? "").toString().trim().toLowerCase();
}

function getEntryType(entry) {
  const t = normalize(entry.type);
  if (t === "apartment" || t === "apartments") return "apartments";
  if (t === "business" || t === "businesses") return "businesses";
  return "residential";
}

function tabAllowsEntry(tab, entry) {
  if (tab === "all") return true;
  return getEntryType(entry) === tab;
}

function entrySearchBlob(group, entry) {
  // Keep city searchable, just not displayed
  return [
    group.community,
    group.region,
    entry.address,
    entry.apartment,
    entry.business,
    entry.gate,
    entry.alternate,
    entry.locker,
    entry.city,
    entry.type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function toMapsUrl(address) {
  // Use query param to keep it simple and reliable
  const q = encodeURIComponent(address);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function toStreetViewUrl(address) {
  // Opens Google Maps in Street View mode (when imagery exists)
  const q = encodeURIComponent(address);
  return `https://www.google.com/maps?q=${q}&layer=c&cbll=0,0`;
}

async function loadData() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL}: ${res.status}`);
  const data = await res.json();
  // Expected shape: [{community, region, addresses:[...]}]
  state.allGroups = Array.isArray(data) ? data : [];
}

function setActiveTab(tab) {
  state.activeTab = tab;

  // aria + active styling
  const map = {
    apartments: "tab-apts",
    residential: "tab-res",
    businesses: "tab-biz",
    all: "tab-all",
  };
  Object.entries(map).forEach(([k, id]) => {
    const el = $(id);
    if (!el) return;
    const active = k === tab;
    el.classList.toggle("active", active);
    el.setAttribute("aria-selected", active ? "true" : "false");
  });

  render();
}

function setQuery(q) {
  state.query = q || "";
  render();
}

function groupKey(group) {
  return `${state.activeTab}|${group.community}`;
}

function toggleGroup(group) {
  const key = groupKey(group);
  if (state.expandedGroups.has(key)) state.expandedGroups.delete(key);
  else state.expandedGroups.add(key);
  render();
}

function copyToClipboard(text) {
  if (!text) return;
  const val = text.toString();
  navigator.clipboard
    ?.writeText(val)
    .then(() => showToast("Copied"))
    .catch(() => {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = val;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showToast("Copied");
    });
}

let toastTimer = null;
function showToast(msg) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1200);
}

function buildGroupHeader(group, visibleCount, expanded) {
  const header = document.createElement("button");
  header.className = "group-header";
  header.type = "button";
  header.addEventListener("click", () => toggleGroup(group));

  const left = document.createElement("div");
  left.className = "group-left";

  const title = document.createElement("div");
  title.className = "group-title";
  title.textContent = group.community || "Untitled";

  const sub = document.createElement("div");
  sub.className = "group-subtitle";
  sub.textContent = group.region || "";

  left.appendChild(title);
  if (sub.textContent) left.appendChild(sub);

  const right = document.createElement("div");
  right.className = "group-right";

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = String(visibleCount);

  const chevron = document.createElement("span");
  chevron.className = "chevron";
  chevron.textContent = expanded ? "▾" : "▸";

  right.appendChild(badge);
  right.appendChild(chevron);

  header.appendChild(left);
  header.appendChild(right);
  return header;
}

function buildEntryCard(group, entry) {
  const card = document.createElement("div");
  card.className = "entry-card";

  const top = document.createElement("div");
  top.className = "entry-top";

  const info = document.createElement("div");
  info.className = "entry-info";

  const addr = document.createElement("div");
  addr.className = "entry-address";
  addr.textContent = entry.address || "";

  // Optional second line for apartment/community label (but NOT city)
  const metaParts = [];
  if (entry.business) metaParts.push(entry.business);
  if (entry.apartment) metaParts.push(entry.apartment);

  if (metaParts.length) {
    const meta = document.createElement("div");
    meta.className = "entry-meta";
    meta.textContent = metaParts.join(" • ");
    info.appendChild(meta);
  }

  info.prepend(addr);

  const actions = document.createElement("div");
  actions.className = "entry-actions";

  const mapsBtn = document.createElement("a");
  mapsBtn.className = "btn btn-secondary";
  mapsBtn.href = toMapsUrl(entry.address || "");
  mapsBtn.target = "_blank";
  mapsBtn.rel = "noopener noreferrer";
  mapsBtn.textContent = "Maps";

  const svBtn = document.createElement("a");
  svBtn.className = "btn btn-secondary";
  svBtn.href = toStreetViewUrl(entry.address || "");
  svBtn.target = "_blank";
  svBtn.rel = "noopener noreferrer";
  svBtn.textContent = "Street View";

  actions.appendChild(mapsBtn);
  actions.appendChild(svBtn);

  top.appendChild(info);
  top.appendChild(actions);

  const codes = document.createElement("div");
  codes.className = "entry-codes";

  const gate = (entry.gate ?? "").toString().trim();
  const alt = (entry.alternate ?? "").toString().trim();
  const locker = (entry.locker ?? "").toString().trim();

  if (gate) {
    codes.appendChild(buildCodePill("Gate", gate));
  }
  if (alt) {
    codes.appendChild(buildCodePill("Alt", alt));
  }
  if (locker) {
    codes.appendChild(buildCodePill("Locker", locker));
  }

  card.appendChild(top);
  if (codes.childElementCount) card.appendChild(codes);

  return card;
}

function buildCodePill(label, value) {
  const wrap = document.createElement("div");
  wrap.className = "code-pill";

  const lab = document.createElement("span");
  lab.className = "code-label";
  lab.textContent = `${label}:`;

  const val = document.createElement("span");
  val.className = "code-value";
  val.textContent = value;

  const copy = document.createElement("button");
  copy.className = "icon-btn";
  copy.type = "button";
  copy.title = "Copy";
  copy.setAttribute("aria-label", `Copy ${label}`);
  copy.textContent = "⧉";
  copy.addEventListener("click", (e) => {
    e.stopPropagation();
    copyToClipboard(value);
  });

  wrap.appendChild(lab);
  wrap.appendChild(val);
  wrap.appendChild(copy);
  return wrap;
}

function computeFilteredGroups() {
  const q = normalize(state.query);
  const tab = state.activeTab;

  const out = [];
  let totalEntries = 0;

  for (const group of state.allGroups) {
    const addresses = Array.isArray(group.addresses) ? group.addresses : [];

    const visibleEntries = addresses.filter((entry) => {
      if (!tabAllowsEntry(tab, entry)) return false;
      if (!q) return true;
      return entrySearchBlob(group, entry).includes(q);
    });

    if (visibleEntries.length) {
      out.push({ group, entries: visibleEntries });
      totalEntries += visibleEntries.length;
    }
  }

  // Sort by group/community name for stable UX
  out.sort((a, b) => (a.group.community || "").localeCompare(b.group.community || ""));
  return { groups: out, totalEntries };
}

function renderSummary(totalEntries, groupCount) {
  const summary = $("summary");
  if (!summary) return;

  let label = "";
  if (state.activeTab === "apartments") label = "Apartments";
  else if (state.activeTab === "residential") label = "Residential";
  else if (state.activeTab === "businesses") label = "Businesses";
  else label = "All";

  summary.textContent = `${label}: ${totalEntries} addresses in ${groupCount} groups`;
}

function render() {
  const list = $("list");
  if (!list) return;

  const { groups, totalEntries } = computeFilteredGroups();
  renderSummary(totalEntries, groups.length);

  list.innerHTML = "";

  for (const { group, entries } of groups) {
    const key = groupKey(group);
    const expanded = state.expandedGroups.has(key);

    const groupCard = document.createElement("section");
    groupCard.className = "group-card";

    const header = buildGroupHeader(group, entries.length, expanded);
    groupCard.appendChild(header);

    if (expanded) {
      const body = document.createElement("div");
      body.className = "group-body";
      for (const entry of entries) body.appendChild(buildEntryCard(group, entry));
      groupCard.appendChild(body);
    }

    list.appendChild(groupCard);
  }
}

function wireUI() {
  $("tab-apts")?.addEventListener("click", () => setActiveTab("apartments"));
  $("tab-res")?.addEventListener("click", () => setActiveTab("residential"));
  $("tab-biz")?.addEventListener("click", () => setActiveTab("businesses"));
  $("tab-all")?.addEventListener("click", () => setActiveTab("all"));

  $("search")?.addEventListener("input", (e) => setQuery(e.target.value));

  // Default tab must match initial UI (apartments active in your screenshot)
  setActiveTab("apartments");
}

(async function init() {
  try {
    wireUI();
    await loadData();
    render();
  } catch (err) {
    console.error(err);
    const list = $("list");
    if (list) {
      list.innerHTML = `<div class="error">Failed to load data. Make sure <b>data.json</b> exists in the repo root.</div>`;
    }
  }
})();
