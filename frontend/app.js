const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const icons = {
  plane: "m22 2-7 20-4-9-9-4 20-7Z|M22 2 11 13",
  hotel:
    "M3 21V3h12v18|M15 9h6v12|M7 7h4|M7 11h4|M7 15h4|M7 21v-3h4v3|M18 13h1|M18 17h1",
  ticket:
    "M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Z|M14 5v3|M14 11v2|M14 16v3",
  map: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z|M9 3v15|M15 6v15",
  orders: "M8 4H5v17h14V4h-3|M8 2h8v5H8z|M8 11h8|M8 15h5",
  agency: "M3 21V7h7V3h11v18|M7 11v1|M7 16v1|M14 7h3|M14 11h3|M14 15h3",
  arrow: "M4 12h16|m14 6 6 6-6 6",
  search: "M21 21l-5-5|M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  calendar: "M8 2v4|M16 2v4|M3 10h18|M3 5h18v17H3z",
  swap: "M4 8h15|m16 5 3 3-3 3|M20 16H5|m8 13-3 3 3 3",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z|M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  check: "m5 12 4 4L19 6",
  close: "M6 6l12 12|M6 18 18 6",
  clock: "M12 7v5l3 2|M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  shield: "m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6l9-4Z|m8 12 3 3 5-6",
  spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z",
  headphones: "M3 14v-3a9 9 0 0 1 18 0v3|M3 12h4v8H3z|M17 12h4v8h-4z",
  sun: "M12 2v2|M12 20v2|M2 12h2|M20 12h2|m5 5 1 1|m18 18 1 1|m5 19 1-1|m18 6 1-1|M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  chevron: "m9 5 7 7-7 7",
  wallet: "M3 5h17v15H3V5Z|M3 5V3h14|M15 10h7v6h-7z",
  download: "M12 3v12|m7 10 5 5 5-5|M3 17v4h18v-4",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0|M22 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75",
};
const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(
    icons[name] || icons.plane
  )
    .split("|")
    .map((d) => `<path d="${d}"/>`)
    .join("")}</svg>`;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) => Number(n).toLocaleString("zh-CN");
const time = (iso) =>
  new Date(iso).toLocaleTimeString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
const dateLabel = (d) =>
  new Date(d + "T12:00:00+08:00").toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
  });
const addDays = (date, n) =>
  new Date(Date.parse(date + "T12:00:00+08:00") + n * 86400000)
    .toISOString()
    .slice(0, 10);
const statusText = {
  PENDING_PAYMENT: "待支付",
  CONFIRMED: "已出票",
  CHECKED_IN: "已值机",
  CANCELLED: "已取消",
  EXPIRED: "已过期",
};
const navs = [
  ["flights", "plane", "机票预订", "FLIGHTS"],
  ["hotels", "hotel", "精选酒店", "HOTELS"],
  ["attractions", "ticket", "门票 · 活动", "EXPERIENCES"],
  ["planner", "map", "行程规划", "TRIP PLANNER"],
  ["orders", "orders", "我的订单", "MY ORDERS"],
  ["agency", "agency", "旅行社工作台", "WORKSPACE"],
];
const state = {
  page: "flights",
  meta: null,
  actor: null,
  query: {
    from: "SHA",
    to: "BJS",
    date: "",
    cabin: "economy",
    passengers: 1,
    sort: "recommended",
  },
  results: null,
  filterAirline: "",
  maxPrice: 4000,
  catalogCity: "",
  planCity: "BJS",
  trip: null,
  orders: [],
  orderFilter: "ALL",
};
let searchGeneration = 0,
  modalTimer;
async function api(url, options = {}) {
  const response = await fetch("/api" + url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    const e = new Error(data.error?.message || "请求失败");
    e.code = data.error?.code;
    throw e;
  }
  return data;
}
const post = (url, body = {}) => api(url, { method: "POST", body });
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 4000);
}
function errorBox(e) {
  return `<div class="inline-error" role="alert">${esc(e.message)}</div>`;
}
async function action(button, fn) {
  if (button.disabled) return;
  const label = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span> 处理中';
  try {
    await fn();
  } catch (e) {
    toast(e.message);
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.innerHTML = label;
    }
  }
}
function navigate(page) {
  location.hash = page;
}
function options(selected, blank = false) {
  return (
    (blank ? '<option value="">全部目的地</option>' : "") +
    state.meta.cities
      .map(
        (c) =>
          `<option value="${c.code}" ${c.code === selected ? "selected" : ""}>${c.name} ${c.code}</option>`,
      )
      .join("")
  );
}
function setRoleLabel() {
  const agency = state.actor?.role === "agency";
  $("#actor-label").textContent = agency ? "旅行社演示" : "体验旅客";
  $(".avatar").textContent = agency ? "社" : "旅";
}
function renderNav() {
  $("#navigation").innerHTML = navs
    .map(
      ([id, i, label, en]) =>
        `<a href="#${id}" class="nav-item ${state.page === id ? "active" : ""}" ${state.page === id ? 'aria-current="page"' : ""}>${icon(i)}<span>${label}<small>${en}</small></span>${id === "planner" ? '<span class="nav-new">NEW</span>' : ""}</a>`,
    )
    .join("");
  $("#page-title").textContent =
    navs.find((n) => n[0] === state.page)?.[2] || "机票预订";
}
function pageHeading(kicker, title, description) {
  return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${description}</p></div><span class="subtle-chip">${icon(shuffleIcon(), 16)} 让旅行简单一点</span></div>`;
}
function shuffleIcon() {
  return "sun";
}
function hero() {
  return `<section class="hero"><div class="hero-copy"><div class="hero-kicker"><span></span> EVERY JOURNEY STARTS HERE</div><h1>下一站，<br class="mobile-only">去看看世界<span>。</span></h1><p>从一张机票开始，把期待变成出发。</p><div class="hero-tags"><span>${icon("shield", 15)} 安心预订</span><span>${icon("spark", 15)} 智能推荐</span><span>${icon("headphones", 15)} 全程相伴</span></div></div><div class="hero-art" aria-hidden="true"><div class="cloud cloud-one"></div><div class="cloud cloud-two"></div><svg viewBox="0 0 430 235"><defs><linearGradient id="wing" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#b4d5ff"/></linearGradient></defs><path d="M35 208C170 132 160 286 364 103" stroke="#8bbcff" stroke-width="2" fill="none" stroke-dasharray="5 6"/><g transform="translate(120 0) rotate(12 120 100)"><path d="m4 90 253-70-94 171-35-76z" fill="url(#wing)"/><path d="M128 115 257 20l-94 171-14-56z" fill="#468ef0"/><path d="m4 90 145 45L257 20 128 115z" fill="#e5f1ff"/></g><circle cx="52" cy="183" r="6" fill="#ffb357"/><circle cx="385" cy="73" r="4" fill="#83b6fa"/></svg><span class="floating-tag">${icon("pin", 15)} 每一程，皆有新风景</span></div></section>`;
}
function searchForm() {
  return `<section class="search-panel" aria-label="航班搜索"><div class="search-panel-top"><div class="search-tab active">${icon("plane", 18)} 国内机票</div><span class="search-note">单程出发，随心而行</span><div class="search-options"><label><span class="sr-only">乘机人数</span><select id="passengers">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${n == state.query.passengers ? "selected" : ""}>${n} 位旅客</option>`).join("")}</select></label><label><span class="sr-only">舱位</span><select id="cabin"><option value="economy" ${state.query.cabin === "economy" ? "selected" : ""}>经济舱</option><option value="business" ${state.query.cabin === "business" ? "selected" : ""}>商务舱</option></select></label></div></div><form id="search-form"><div class="route-input"><label for="from">出发城市</label><select id="from" required>${options(state.query.from)}</select><span class="airport-note">选择出发地</span></div><button class="swap-button" type="button" id="swap" aria-label="交换出发地和目的地">${icon("swap", 20)}</button><div class="route-input"><label for="to">到达城市</label><select id="to" required>${options(state.query.to)}</select><span class="airport-note">想去哪里走走？</span></div><div class="date-input"><label for="departure-date">出发日期</label><div>${icon("calendar", 20)}<input type="date" id="departure-date" min="${state.meta.today}" max="${addDays(state.meta.today, 180)}" value="${state.query.date}" required></div><span class="airport-note">发现旅程中的美好</span></div><button class="primary search-submit" type="submit" id="search-button">${icon("search", 21)} 搜索机票</button></form><div id="search-error"></div><div class="popular-routes"><span>热门航线</span>${[
    ["SHA", "BJS"],
    ["SHA", "CTU"],
    ["BJS", "SYX"],
  ]
    .map(
      ([f, t]) =>
        `<button class="text-button quick-route" data-from="${f}" data-to="${t}">${cityName(f)} ${icon("arrow", 12)} ${cityName(t)}</button>`,
    )
    .join(
      "",
    )}<span class="simulation-note">实时演示 · 票价为模拟数据</span></div></section>`;
}
const cityName = (code) =>
  state.meta.cities.find((c) => c.code === code)?.name || code;
function flightsPage() {
  $("#app").innerHTML =
    hero() +
    searchForm() +
    `<section class="flight-section"><div class="section-heading"><div><span class="eyebrow">FIND YOUR PERFECT FLIGHT</span><h2 id="results-title">为你找到更合适的一程</h2></div><div class="result-sort"><label for="sort">排序</label><select id="sort"><option value="recommended">智能推荐</option><option value="price">价格从低到高</option><option value="departure">起飞时间</option><option value="duration">飞行时长</option></select></div></div><div id="date-strip" class="date-strip"></div><div class="flight-layout"><aside class="filters"><div class="filter-title"><strong>筛选条件</strong><button class="text-button" id="reset-filter">重置</button></div><div class="filter-group"><h3>航空公司</h3><div id="airline-filters"></div></div><div class="filter-group"><h3>价格预算 <span>含税 / 人</span></h3><label for="price-range" class="price-budget">¥ <strong id="budget-label">4,000</strong> 以下</label><input id="price-range" type="range" min="300" max="4000" step="50" value="${state.maxPrice}"><div class="range-labels"><span>¥300</span><span>¥4,000</span></div></div><div class="filter-assurance">${icon("shield", 26)}<strong>每一个选择，都安心</strong><p>含税价格透明展示<br>模拟报价锁定 10 分钟</p></div></aside><div id="flight-results" aria-live="polite"><div class="loading-card">正在搜索航班…</div></div></div></section>` +
    destinations() +
    `<div class="trust-strip"><div>${icon("shield", 26)}<span><strong>透明价格</strong><small>税费清晰，无隐藏费用</small></span></div><div>${icon("clock", 26)}<span><strong>高效出行</strong><small>预订、值机，一站完成</small></span></div><div>${icon("map", 26)}<span><strong>自在规划</strong><small>机票与目的地灵感相连</small></span></div></div>`;
  $("#sort").value = state.query.sort;
  $("#search-form").onsubmit = (e) => {
    e.preventDefault();
    state.query = {
      ...state.query,
      from: $("#from").value,
      to: $("#to").value,
      date: $("#departure-date").value,
      cabin: $("#cabin").value,
      passengers: Number($("#passengers").value),
    };
    search();
  };
  $("#swap").onclick = () => {
    const a = $("#from").value;
    $("#from").value = $("#to").value;
    $("#to").value = a;
  };
  $$(".quick-route").forEach(
    (b) =>
      (b.onclick = () => {
        $("#from").value = b.dataset.from;
        $("#to").value = b.dataset.to;
        $("#search-form").requestSubmit();
      }),
  );
  $("#sort").onchange = () => {
    state.query.sort = $("#sort").value;
    renderResults();
  };
  $("#price-range").oninput = (e) => {
    state.maxPrice = Number(e.target.value);
    $("#budget-label").textContent = money(state.maxPrice);
    renderResults();
  };
  $("#reset-filter").onclick = () => {
    state.filterAirline = "";
    state.maxPrice = 4000;
    $("#price-range").value = 4000;
    $("#budget-label").textContent = "4,000";
    renderAirlines();
    renderResults();
  };
  wireDestinations();
  search();
}
async function search() {
  const gen = ++searchGeneration;
  const button = $("#search-button");
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span> 搜索中';
  $("#search-error").innerHTML = "";
  $("#flight-results").innerHTML =
    '<div class="loading-card"><span class="spinner blue"></span> 正在为你匹配航班…</div>';
  try {
    const data = await api("/flights?" + new URLSearchParams(state.query));
    if (gen !== searchGeneration || state.page !== "flights") return;
    state.results = data;
    $("#results-title").textContent =
      `${cityName(data.query.from)} → ${cityName(data.query.to)}`;
    renderDates();
    renderAirlines();
    renderResults();
  } catch (e) {
    if (gen !== searchGeneration || state.page !== "flights") return;
    state.results = null;
    $("#search-error").innerHTML = errorBox(e);
    $("#flight-results").innerHTML =
      '<div class="empty-state">调整搜索条件，重新开启旅程。</div>';
  } finally {
    if (gen === searchGeneration && button.isConnected) {
      button.disabled = false;
      button.innerHTML = icon("search", 21) + " 搜索机票";
    }
  }
}
function renderDates() {
  $("#date-strip").innerHTML = state.results.calendar
    .map(
      (d) =>
        `<button class="date-chip ${d.date === state.query.date ? "selected" : ""}" data-date="${d.date}" ${d.date < state.meta.today ? "disabled" : ""}><span>${dateLabel(d.date)} <small>${["日", "一", "二", "三", "四", "五", "六"][new Date(d.date).getUTCDay()]}</small></span><strong>¥${money(d.price)}<small>起</small></strong></button>`,
    )
    .join("");
  $$(".date-chip").forEach(
    (b) =>
      (b.onclick = () => {
        state.query.date = b.dataset.date;
        $("#departure-date").value = b.dataset.date;
        search();
      }),
  );
}
function renderAirlines() {
  const airlines = [
    ...new Map(
      state.results.flights.map((f) => [f.airline.code, f.airline]),
    ).values(),
  ];
  $("#airline-filters").innerHTML =
    `<label class="check-row"><input type="radio" name="airline" value="" ${!state.filterAirline ? "checked" : ""}>全部航空公司</label>` +
    airlines
      .map(
        (a) =>
          `<label class="check-row"><input type="radio" name="airline" value="${a.code}" ${state.filterAirline === a.code ? "checked" : ""}>${a.name}</label>`,
      )
      .join("");
  $$("[name=airline]").forEach(
    (e) =>
      (e.onchange = () => {
        state.filterAirline = e.value;
        renderResults();
      }),
  );
}
function renderResults() {
  if (!state.results) return;
  let flights = state.results.flights.filter(
    (f) =>
      (!state.filterAirline || f.airline.code === state.filterAirline) &&
      f.price <= state.maxPrice,
  );
  const sort = state.query.sort;
  flights.sort((a, b) =>
    sort === "price"
      ? a.price - b.price
      : sort === "departure"
        ? Date.parse(a.departure) - Date.parse(b.departure)
        : sort === "duration"
          ? a.duration - b.duration
          : b.score - a.score,
  );
  $("#flight-results").innerHTML =
    `<div class="results-info"><span>共 <strong>${flights.length}</strong> 个可选航班 · ${dateLabel(state.query.date)}</span><span>${icon("check", 14)} 价格已含税费</span></div>` +
    (flights.length
      ? flights
          .map(
            (f, i) =>
              `<article class="flight-card ${i === 0 && sort === "recommended" ? "recommended" : ""}">${i === 0 && sort === "recommended" ? '<div class="recommend-label">' + icon("spark", 12) + " 为你推荐</div>" : ""}<div class="airline"><span class="airline-mark" style="--airline:${f.airline.color}">${icon("plane", 23)}</span><div><strong>${f.airline.name}</strong><small>${f.number} · ${f.aircraft}</small></div></div><div class="flight-route"><div class="flight-time"><strong>${time(f.departure)}</strong><span>${f.fromCity.airport.replace("国际机场", "")} ${f.fromCity.terminal}</span></div><div class="route-line"><small>${Math.floor(f.duration / 60)}小时${f.duration % 60}分 · 直飞</small><span>${icon("plane", 15)}</span><small>${state.query.cabin === "business" ? "商务舱" : "经济舱"} · 余 ${f.seats} 座</small></div><div class="flight-time"><strong>${time(f.arrival)}</strong><span>${f.toCity.airport.replace("国际机场", "")} ${f.toCity.terminal}</span></div></div><div class="flight-price"><span class="price"><small>¥</small>${money(f.price)}<em> / 人</em></span><small>含机建燃油 ¥${f.tax}</small></div><button class="book-button" data-flight="${f.id}">预订 ${icon("chevron", 15)}</button><div class="flight-card-bottom"><span>${f.reasons.map((r) => `<span class="tag">${r}</span>`).join("")}</span><span>模拟航班 · 支持在线值机</span></div></article>`,
          )
          .join("")
      : '<div class="empty-state">' +
        icon("search", 36) +
        "<h3>没有符合条件的航班</h3><p>试试调整预算或重置航空公司筛选。</p></div>");
  $$("[data-flight]").forEach(
    (b) => (b.onclick = () => action(b, () => book(b.dataset.flight))),
  );
}
function destinations() {
  return `<section class="destinations-section"><div class="section-heading"><div><span class="eyebrow">SOMEWHERE NEW, SOMETHING YOU</span><h2>下一程的灵感</h2></div><button class="text-button more-button" id="all-destinations">探索更多目的地 ${icon("arrow", 17)}</button></div><div class="destination-grid">${[
    {
      city: "CTU",
      name: "成都",
      sub: "把日子过成慢时光",
      asset: "chengdu",
      price: 398,
    },
    {
      city: "SYX",
      name: "三亚",
      sub: "在海风里，放空自己",
      asset: "sanya",
      price: 568,
    },
    {
      city: "HGH",
      name: "杭州",
      sub: "一半山水，一半诗意",
      asset: "hangzhou",
      price: 328,
    },
    {
      city: "XIY",
      name: "西安",
      sub: "与千年长安，不期而遇",
      asset: "xian",
      price: 458,
    },
  ]
    .map(
      (d) =>
        `<button class="destination-card" data-destination="${d.city}"><img src="/assets/${d.asset}.svg" alt="${d.name}城市风景插画" loading="lazy" width="600" height="400"><div class="destination-copy"><span><strong>${d.name}</strong><small>${d.sub}</small></span><span class="destination-price">¥${d.price}<small>起</small></span></div></button>`,
    )
    .join("")}</div></section>`;
}
function wireDestinations() {
  $("#all-destinations").onclick = () => navigate("planner");
  $$("[data-destination]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.destination === state.query.from) {
          toast("目的地与出发地相同，请选择其他城市");
          return;
        }
        state.query.to = b.dataset.destination;
        $("#to").value = b.dataset.destination;
        search();
        $("#search-form").scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }),
  );
}
function openModal(html) {
  clearInterval(modalTimer);
  $("#modal-body").innerHTML = html;
  const dialog = $("#modal");
  if (!dialog.open) dialog.showModal();
  $$("[data-close]").forEach((b) => (b.onclick = () => dialog.close()));
}
function modalHeader(kicker, title) {
  return `<header class="modal-header"><div><span class="eyebrow">${kicker}</span><h2 id="modal-title">${title}</h2></div><button class="icon-button" data-close aria-label="关闭弹窗">${icon("close", 23)}</button></header>`;
}
async function book(id) {
  const quote = await post("/quotes", {
    flightId: id,
    passengers: state.query.passengers,
    cabin: state.query.cabin,
  });
  const f = quote.flight;
  const key = crypto.randomUUID();
  openModal(
    modalHeader("BOOK YOUR JOURNEY", "确认这一程") +
      `<div class="booking-flight"><div><strong>${f.fromCity.name} ${icon("arrow", 21)} ${f.toCity.name}</strong><span>${dateLabel(f.date)} · ${f.airline.name} ${f.number}</span></div><b>${time(f.departure)}—${time(f.arrival)}</b></div><div class="quote-notice">${icon("clock", 17)} 报价已锁定，剩余 <strong id="quote-countdown">10:00</strong> · 含税总价 ¥${money(quote.amount)}</div><form id="booking-form"><div class="form-section-title"><h3>乘机人信息</h3><button type="button" class="text-button" id="fill-demo">填入演示信息</button></div><p class="muted">课程演示请使用虚构姓名与证件号。</p>${Array.from({ length: quote.passengers }, (_, i) => `<fieldset class="passenger-fields"><legend>旅客 ${i + 1}</legend><div class="field-grid"><label>姓名<input name="name-${i}" id="passenger-name-${i}" placeholder="与证件姓名一致" required minlength="2" maxlength="40"></label><label>演示证件号<input name="document-${i}" id="passenger-document-${i}" placeholder="6–20 位字母或数字" required pattern="[A-Za-z0-9]{6,20}" minlength="6" maxlength="20"></label></div></fieldset>`).join("")}<label class="standalone-field">联系手机号<input id="contact-phone" type="tel" placeholder="用于接收行程提醒" pattern="1[3-9][0-9]{9}" maxlength="11" required></label><div id="booking-error"></div><div class="booking-total"><div><small>${quote.passengers} 位旅客 · ${quote.cabin === "business" ? "商务舱" : "经济舱"}</small><span>订单总额 <strong>¥${money(quote.amount)}</strong></span></div><button class="primary" type="submit" id="create-order">确认并创建订单 ${icon("arrow", 18)}</button></div><p class="form-footnote">提交后为你保留座位 15 分钟。演示支付不会扣款。</p></form>`,
  );
  modalTimer = setInterval(() => {
    const seconds = Math.max(
      0,
      Math.ceil((Date.parse(quote.expiresAt) - Date.now()) / 1000),
    );
    const el = $("#quote-countdown");
    if (el)
      el.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }, 1000);
  $("#fill-demo").onclick = () => {
    for (let i = 0; i < quote.passengers; i++) {
      $(`#passenger-name-${i}`).value = [
        "云小程",
        "林小雨",
        "陈星河",
        "周知夏",
        "江远行",
        "李清风",
      ][i];
      $(`#passenger-document-${i}`).value = `DEMO2026000${i}`;
    }
    $("#contact-phone").value = "13800000000";
  };
  $("#booking-form").onsubmit = (e) => {
    e.preventDefault();
    action($("#create-order"), async () => {
      try {
        const order = await api("/orders", {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: {
            quoteId: quote.id,
            contact: $("#contact-phone").value,
            passengers: Array.from({ length: quote.passengers }, (_, i) => ({
              name: $(`#passenger-name-${i}`).value.trim(),
              document: $(`#passenger-document-${i}`).value,
            })),
          },
        });
        toast("订单创建成功，已为你保留座位");
        await showOrder(order);
      } catch (err) {
        $("#booking-error").innerHTML = errorBox(err);
      }
    });
  };
}
async function ordersPage() {
  $("#app").innerHTML =
    pageHeading(
      "YOUR JOURNEY, WELL ORGANIZED",
      "每一程，都在这里",
      "管理你的预订、完成支付，轻松开启下一段旅程。",
    ) +
    `<div class="order-tabs">${[
      ["ALL", "全部订单"],
      ["PENDING_PAYMENT", "待支付"],
      ["CONFIRMED", "已出票"],
      ["CHECKED_IN", "已值机"],
    ]
      .map(
        ([s, t]) =>
          `<button data-status="${s}" class="${state.orderFilter === s ? "selected" : ""}">${t}</button>`,
      )
      .join(
        "",
      )}</div><div id="orders-list" class="order-list"><div class="loading-card">正在读取订单…</div></div>`;
  $$("[data-status]").forEach(
    (b) =>
      (b.onclick = () => {
        state.orderFilter = b.dataset.status;
        $$("[data-status]").forEach((a) =>
          a.classList.toggle("selected", a === b),
        );
        renderOrders();
      }),
  );
  try {
    state.orders = (await api("/orders")).orders;
    if (state.page === "orders") renderOrders();
  } catch (e) {
    $("#orders-list").innerHTML = errorBox(e);
  }
}
function orderRoute(o) {
  return `<div class="order-route"><div class="order-city"><strong>${o.flight.fromCity.name}</strong><span>${time(o.flight.departure)} ${o.flight.fromCity.terminal}</span></div><div class="order-line">${icon("plane", 22)}<small>${dateLabel(o.flight.date)}</small></div><div class="order-city"><strong>${o.flight.toCity.name}</strong><span>${time(o.flight.arrival)} ${o.flight.toCity.terminal}</span></div></div>`;
}
function renderOrders() {
  const orders = state.orders.filter(
    (o) => state.orderFilter === "ALL" || o.status === state.orderFilter,
  );
  $("#orders-list").innerHTML = orders.length
    ? orders
        .map(
          (o) =>
            `<article class="order-card"><div class="order-card-head"><span>${o.flight.airline.name} · ${o.flight.number}<small>订单号 ${o.id}</small></span><span class="status-badge ${o.status.toLowerCase()}">${statusText[o.status]}</span></div><div class="order-card-main">${orderRoute(o)}<div class="order-passengers">${icon("users", 19)}<span>${o.passengers.map((p) => esc(p.name)).join("、")}<small>${o.passengers.length} 位旅客 · ${o.role === "agency" ? "旅行社代订" : "个人出行"}</small></span></div><div class="order-card-price"><strong>¥${money(o.amount)}</strong><button class="${o.status === "PENDING_PAYMENT" ? "primary" : "secondary"}" data-order="${o.id}">${o.status === "PENDING_PAYMENT" ? "去支付" : o.status === "CHECKED_IN" ? "查看登机牌" : "订单详情"}</button></div></div></article>`,
        )
        .join("")
    : `<div class="empty-state spacious">${icon("orders", 46)}<h2>还没有${state.orderFilter === "ALL" ? "" : statusText[state.orderFilter]}订单</h2><p>世界那么大，你的下一程正等着出发。</p><button id="go-flights" class="primary">去看看机票 ${icon("arrow", 18)}</button></div>`;
  $$("[data-order]").forEach(
    (b) =>
      (b.onclick = () =>
        action(b, async () =>
          showOrder(await api("/orders/" + b.dataset.order)),
        )),
  );
  if ($("#go-flights")) $("#go-flights").onclick = () => navigate("flights");
}
async function showOrder(o) {
  const f = o.flight;
  openModal(
    modalHeader(
      "JOURNEY DETAILS",
      o.status === "CHECKED_IN"
        ? "你的登机牌"
        : o.status === "PENDING_PAYMENT"
          ? "出发前的最后一步"
          : "订单详情",
    ) +
      `<div class="order-detail-status"><span class="status-badge ${o.status.toLowerCase()}">${statusText[o.status]}</span><span>订单号 ${o.id}</span></div>${orderRoute(o)}<div class="detail-meta"><span>${f.airline.name} ${f.number}</span><span>${f.fromCity.airport} → ${f.toCity.airport}</span></div><div class="detail-passengers">${o.passengers.map((p) => `<div><strong>${esc(p.name)}</strong><span>证件 · ${esc(p.document.slice(0, 2))}****${esc(p.document.slice(-2))}</span></div>`).join("")}<p>联系手机号 ${o.contact.slice(0, 3)}****${o.contact.slice(-4)}</p></div>${o.boarding ? `<div class="boarding-card"><div><span>SEAT / 座位</span><strong>${o.boarding.seat}</strong></div><div><span>GATE / 登机口</span><strong>${o.boarding.gate}</strong></div><div><span>BOARDING / 登机时间</span><strong>${time(o.boarding.boardingAt)}</strong></div><p>PNR ${o.boarding.pnr} · 模拟登机牌，仅用于课程演示</p></div>` : ""}<div class="order-timeline">${o.events.map((e) => `<div><i></i><strong>${{ CREATED: "订单已创建", PAYMENT_SUCCEEDED: "模拟支付成功", TICKET_ISSUED: "模拟航信已出票", CHECKED_IN: "在线值机完成", CANCELLED: "订单已取消", EXPIRED: "支付超时，已释放座位", PAYMENT_FAILED: "模拟支付失败" }[e.type] || esc(e.type)}</strong><span>${time(e.at)}</span></div>`).join("")}</div><div id="order-error"></div><div class="order-total"><span>订单总额 <strong>¥${money(o.amount)}</strong></span><small>已含税费 · 模拟交易</small></div><div class="modal-actions">${o.status === "PENDING_PAYMENT" ? '<button class="secondary" id="fail-payment">模拟支付失败</button><button class="primary" id="pay-order">' + icon("wallet", 18) + " 模拟支付 ¥" + money(o.amount) + "</button>" : ""}${o.status === "CONFIRMED" ? '<button class="primary" id="start-checkin">' + icon("check", 18) + " 在线值机</button>" : ""}${["PENDING_PAYMENT", "CONFIRMED"].includes(o.status) ? '<button class="text-button danger" id="cancel-order">取消订单</button>' : ""}${o.status === "CHECKED_IN" ? '<button class="secondary" id="download-boarding">' + icon("download", 18) + " 保存行程信息</button>" : ""}</div><p class="form-footnote">${o.status === "PENDING_PAYMENT" ? "请于 " + time(o.expiresAt) + " 前支付，超时自动释放座位。" : o.status === "CONFIRMED" ? "值机开放时间：起飞前 48 小时至 45 分钟。当前值机演示支持单人订单。" : "演示订单状态以服务端保存记录为准。"}</p>`,
  );
  const refresh = async () => {
    if (state.page === "orders") await ordersPage();
  };
  if ($("#pay-order"))
    $("#pay-order").onclick = () =>
      action($("#pay-order"), async () => {
        const paid = await post(`/orders/${o.id}/pay`);
        toast("模拟支付成功，已完成出票");
        await showOrder(paid);
        await refresh();
      });
  if ($("#fail-payment"))
    $("#fail-payment").onclick = () =>
      action($("#fail-payment"), async () => {
        try {
          await post(`/orders/${o.id}/pay`, { simulateFailure: true });
        } catch (e) {
          $("#order-error").innerHTML = errorBox(e);
        }
      });
  if ($("#cancel-order"))
    $("#cancel-order").onclick = () => {
      openModal(
        modalHeader("CANCEL RESERVATION", "确认取消这一程？") +
          `<p class="cancel-description">${esc(f.fromCity.name)} → ${esc(f.toCity.name)} · ${dateLabel(f.date)}<br>取消后座位将释放。${o.status === "CONFIRMED" ? "模拟全额退款 ¥" + money(o.amount) + "。" : "本订单尚未支付。"}</p><div class="modal-actions"><button class="secondary" id="keep-order">保留订单</button><button class="primary danger-fill" id="confirm-cancel">确认取消订单</button></div>`,
      );
      $("#keep-order").onclick = () => showOrder(o);
      $("#confirm-cancel").onclick = () =>
        action($("#confirm-cancel"), async () => {
          await showOrder(await post(`/orders/${o.id}/cancel`));
          toast("订单已取消，座位已释放");
          await refresh();
        });
    };
  if ($("#start-checkin"))
    $("#start-checkin").onclick = () =>
      action($("#start-checkin"), () => checkin(o));
  if ($("#download-boarding"))
    $("#download-boarding").onclick = () => {
      const text = `云程旅行 · 模拟行程\n${o.id}\n${f.fromCity.name} → ${f.toCity.name}\n${f.number} ${f.date} ${time(f.departure)}\n旅客 ${o.passengers.map((p) => p.name).join("、")}\n座位 ${o.boarding.seat} · 登机口 ${o.boarding.gate}\n模拟数据，无真实运输效力`;
      download("行程-" + o.id + ".txt", text);
    };
}
async function checkin(o) {
  const remaining = Date.parse(o.flight.departure) - Date.now();
  if (remaining > 48 * 3600000 || remaining <= 45 * 60000) {
    toast("值机将在起飞前 48 小时至 45 分钟开放");
    return;
  }
  if (o.passengers.length !== 1) {
    toast("当前在线值机演示支持单人订单");
    return;
  }
  const { taken } = await api(`/orders/${o.id}/seats`);
  let selected = "";
  openModal(
    modalHeader("CHOOSE YOUR FAVORITE SEAT", "选个喜欢的位置") +
      `<div class="seat-legend"><span><i></i>可选</span><span><i class="selected"></i>已选</span><span><i class="taken"></i>已占用</span></div><div class="seat-map"><div class="seat-cockpit">机头方向 ${icon("plane", 21)}</div><div class="seat-columns"><span>A</span><span>B</span><span>C</span><em></em><span>D</span><span>E</span><span>F</span></div>${Array.from({ length: 30 }, (_, i) => `<div class="seat-row"><small>${i + 1}</small>${[..."ABCDEF"].map((c, j) => `${j === 3 ? "<em></em>" : ""}<button class="seat ${taken.includes(i + 1 + c) ? "taken" : ""}" aria-label="选择座位 ${i + 1}${c}" data-seat="${i + 1}${c}" ${taken.includes(i + 1 + c) ? "disabled" : ""}>${i + 1}${c}</button>`).join("")}</div>`).join("")}</div><div class="seat-confirm"><span>已选座位 <strong id="chosen-seat">尚未选择</strong></span><button class="primary" id="confirm-checkin" disabled>确认值机 ${icon("check", 18)}</button></div><div id="checkin-error"></div>`,
  );
  $$("[data-seat]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = b.dataset.seat;
        $$("[data-seat]").forEach((e) => {
          e.classList.toggle("selected", e === b);
          e.setAttribute("aria-pressed", String(e === b));
        });
        $("#chosen-seat").textContent = selected;
        $("#confirm-checkin").disabled = false;
      }),
  );
  $("#confirm-checkin").onclick = () =>
    action($("#confirm-checkin"), async () => {
      try {
        await showOrder(
          await post(`/orders/${o.id}/check-in`, { seat: selected }),
        );
        toast("值机完成，祝你旅途愉快");
        if (state.page === "orders") await ordersPage();
      } catch (e) {
        $("#checkin-error").innerHTML = errorBox(e);
      }
    });
}
function download(name, text) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function catalogPage(kind) {
  const isHotel = kind === "hotels";
  $("#app").innerHTML =
    pageHeading(
      isHotel ? "STAY A LITTLE LONGER" : "MAKE EVERY MOMENT COUNT",
      isHotel ? "住进旅途里的好时光" : "让目的地，多一点精彩",
      isHotel
        ? "精选城市好住处，让每一次停留都值得期待。"
        : "从城市地标到自然风景，找到属于你的旅行体验。",
    ) +
    `<div class="catalog-toolbar"><label>目的地 <select id="catalog-city">${options(state.catalogCity, true)}</select></label><span>本地精选 · ${isHotel ? "模拟每晚房价" : "模拟成人门票价"}</span></div><div class="catalog-grid" id="catalog-items"><div class="loading-card">正在寻找好去处…</div></div>`;
  $("#catalog-city").onchange = () => {
    state.catalogCity = $("#catalog-city").value;
    load();
  };
  async function load() {
    try {
      const { items } = await api(`/${kind}?city=${state.catalogCity}`);
      if (state.page !== kind) return;
      $("#catalog-items").innerHTML = items.length
        ? items
            .map(
              (item) =>
                `<article class="catalog-card"><div class="catalog-image"><img src="/assets/${item.image}.svg" alt="${item.cityName}目的地插画" width="600" height="400" loading="lazy"><span>${isHotel ? item.tag : item.category}</span></div><div class="catalog-card-body"><div class="catalog-location">${icon("pin", 14)} ${item.cityName} ${isHotel ? "· " + item.area : ""}</div><h2>${esc(item.name)}</h2>${isHotel ? `<div class="hotel-rating"><strong>${item.rating}</strong><span>超棒 · 模拟评分</span></div><div class="amenities">${item.amenities.map((a) => `<span>${a}</span>`).join("")}</div>` : `<p class="muted">建议游玩 ${Math.round((item.duration / 60) * 10) / 10} 小时 · 成人票</p>`}<div class="catalog-bottom"><span class="price"><small>¥</small>${money(item.price)}<em> / ${isHotel ? "晚" : "人"}</em></span><button class="secondary" data-plan-city="${item.city}">规划${isHotel ? "住宿" : "游玩"} ${icon("arrow", 16)}</button></div></div></article>`,
            )
            .join("")
        : '<div class="empty-state">该城市暂未收录精选内容，试试其他目的地。</div>';
      $$("[data-plan-city]").forEach(
        (b) =>
          (b.onclick = () => {
            state.planCity = b.dataset.planCity;
            navigate("planner");
          }),
      );
    } catch (e) {
      $("#catalog-items").innerHTML = errorBox(e);
    }
  }
  await load();
}
async function plannerPage() {
  $("#app").innerHTML =
    pageHeading(
      "A LITTLE PLANNING, A LOT OF WONDER",
      "把旅行的期待，排进日程",
      "从目的地到每一天的安排，一起勾勒你的理想旅程。",
    ) +
    `<div class="planner-layout"><section class="planner-form-card"><div class="planner-icon">${icon("map", 32)}</div><h2>你的旅程，你做主</h2><p>告诉我们你的想法，生成一份专属行程。</p><form id="planner-form"><label>想去哪里<select id="plan-city">${options(state.planCity)}</select></label><label>旅行天数<select id="plan-days">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}" ${n === 3 ? "selected" : ""}>${n} 天${n > 1 ? " " + (n - 1) + " 晚" : ""}</option>`).join("")}</select></label><label>地面行程预算（元）<input id="plan-budget" type="number" min="100" max="100000" step="100" value="3000" required></label><div class="planner-note">${icon("spark", 19)} 根据本地酒店、景点与游玩时长生成规则式行程，预算不包含往返机票。</div><button class="primary" type="submit" id="generate-plan">生成我的行程 ${icon("arrow", 18)}</button><div id="planner-error"></div></form></section><section id="plan-output"><div class="planner-empty"><img src="/assets/hangzhou.svg" alt="湖畔山水插画" width="600" height="400"><span class="eyebrow">YOUR NEXT CHAPTER</span><h2>美好的旅程，从这里开始</h2><p>选择一个目的地，让我们为你安排接下来的每一天。</p></div></section></div><section id="saved-trips" class="saved-trips"></section>`;
  $("#planner-form").onsubmit = (e) => {
    e.preventDefault();
    action($("#generate-plan"), async () => {
      try {
        state.trip = await post("/trips", {
          city: $("#plan-city").value,
          days: Number($("#plan-days").value),
          budget: Number($("#plan-budget").value),
        });
        state.planCity = state.trip.city;
        renderPlan(state.trip);
        await savedTrips();
      } catch (err) {
        $("#planner-error").innerHTML = errorBox(err);
      }
    });
  };
  if (state.trip) renderPlan(state.trip);
  await savedTrips();
}
function renderPlan(trip) {
  $("#plan-output").innerHTML =
    `<div class="trip-head"><div><span class="eyebrow">YOUR PERSONAL ITINERARY</span><h2>${trip.cityName} · ${trip.days} 日旅行计划</h2><p>预计地面花费 <strong>¥${money(trip.estimatedTotal)}</strong> <span class="${trip.withinBudget ? "budget-ok" : "budget-over"}">${trip.withinBudget ? "在预算内" : "超出预算，建议缩短行程"}</span></p></div><button class="icon-button" id="download-trip" aria-label="下载行程">${icon("download", 21)}</button></div>${trip.hotel ? `<div class="trip-hotel">${icon("hotel", 22)}<div><strong>${trip.hotel.name}</strong><small>建议住宿 · ¥${trip.hotel.price} / 晚 · ${Math.max(0, trip.days - 1)} 晚</small></div></div>` : ""}<div class="itinerary">${trip.itinerary.map((day) => `<article class="day-card"><div class="day-heading"><span>DAY ${String(day.day).padStart(2, "0")}</span><h3>${day.title}</h3></div>${day.activities.map((a) => `<div class="activity"><span>${a.time}</span><i></i><strong>${a.name}</strong>${a.duration ? `<small>约 ${a.duration} 分钟</small>` : ""}</div>`).join("")}</article>`).join("")}</div><p class="form-footnote">${trip.algorithm}。景点开放、预约与交通时间需实际出行前确认。</p>`;
  $("#download-trip").onclick = () =>
    download(
      `${trip.cityName}行程.txt`,
      `${trip.cityName} ${trip.days}日行程\n预算 ${trip.budget} / 预计 ${trip.estimatedTotal} 元（不含机票）\n\n` +
        trip.itinerary
          .map(
            (d) =>
              `DAY ${d.day} ${d.title}\n` +
              d.activities.map((a) => `${a.time} ${a.name}`).join("\n"),
          )
          .join("\n\n") +
        "\n\n" +
        trip.algorithm,
    );
}
async function savedTrips() {
  const { trips } = await api("/trips");
  if (state.page !== "planner") return;
  $("#saved-trips").innerHTML = trips.length
    ? '<h2>已保存的旅行灵感</h2><div class="saved-trip-grid">' +
      trips
        .map(
          (t) =>
            `<button class="saved-trip" data-trip="${t.id}">${icon("map", 23)}<span><strong>${t.cityName} · ${t.days} 日</strong><small>预计 ¥${money(t.estimatedTotal)}</small></span>${icon("chevron", 18)}</button>`,
        )
        .join("") +
      "</div>"
    : "";
  $$("[data-trip]").forEach(
    (b) =>
      (b.onclick = () => {
        state.trip = trips.find((t) => t.id === b.dataset.trip);
        renderPlan(state.trip);
        $("#plan-output").scrollIntoView({ behavior: "smooth" });
      }),
  );
}
async function agencyPage() {
  if (state.actor.role !== "agency") {
    $("#app").innerHTML =
      pageHeading(
        "TRAVEL AGENCY WORKSPACE",
        "为每一位旅客，安排好每一程",
        "旅行社可代旅客预订，并统一管理本角色的订单与出行。",
      ) +
      `<div class="agency-welcome"><div class="planner-icon">${icon("agency", 38)}</div><h2>旅行社演示工作台</h2><p>切换到旅行社角色，体验代订、订单统计与统一管理。</p><button class="primary" id="switch-agency">进入旅行社演示 ${icon("arrow", 18)}</button><small>演示角色切换不代表生产系统身份认证。</small></div>`;
    $("#switch-agency").onclick = () =>
      action($("#switch-agency"), () => login("agency"));
    return;
  }
  const metrics = await api("/agency");
  $("#app").innerHTML =
    pageHeading(
      "TRAVEL AGENCY WORKSPACE",
      "你好，云程旅行社",
      "把繁琐交给系统，把时间留给旅客。",
    ) +
    `<div class="metrics-grid">${[
      ["orders", "代订订单", metrics.orders, "笔"],
      ["wallet", "已出票金额", "¥" + money(metrics.revenue), ""],
      ["clock", "待支付订单", metrics.pending, "笔"],
      ["users", "有效出行旅客", metrics.travelers, "位"],
    ]
      .map(
        ([i, t, v, u]) =>
          `<div class="metric-card"><span>${icon(i, 22)}</span><small>${t}</small><strong>${v}<em>${u}</em></strong></div>`,
      )
      .join(
        "",
      )}</div><div class="agency-actions"><button class="primary" id="agency-book">${icon("plane", 19)} 为旅客预订机票</button><button class="secondary" id="agency-orders">查看代订订单 ${icon("arrow", 18)}</button></div><div class="integration-grid"><article><span class="integration-status">${icon("check", 15)} 模拟服务已就绪</span><h2>支付网关</h2><p>模拟成功与失败响应，固定交易编号支持重复支付幂等。不会扣除真实资金。</p><code>MockPaymentProvider</code></article><article><span class="integration-status">${icon("check", 15)} 模拟服务已就绪</span><h2>航信 / 在线值机</h2><p>模拟出票、PNR、登机口与座位分配；服务端校验状态和座位占用。</p><code>MockAviationProvider</code></article></div>`;
  $("#agency-book").onclick = () => navigate("flights");
  $("#agency-orders").onclick = () => navigate("orders");
}
async function login(role) {
  state.actor = (await post("/session", { role })).actor;
  setRoleLabel();
  $("#modal").close();
  toast(role === "agency" ? "已切换至旅行社演示角色" : "已切换至旅客演示角色");
  await renderPage();
}
function roles() {
  openModal(
    modalHeader("DEMO EXPERIENCE", "选择你的出行身份") +
      `<p class="role-description">两个角色使用独立的演示订单空间。此为本地课程系统，无需真实账户或个人信息。</p><button class="role-card" data-role="traveler">${icon("users", 28)}<span><strong>我是旅客</strong><small>查航班、订机票、管理个人行程</small></span>${icon("chevron", 20)}</button><button class="role-card" data-role="agency">${icon("agency", 28)}<span><strong>我是旅行社</strong><small>为旅客代订，统一管理出行订单</small></span>${icon("chevron", 20)}</button>`,
  );
  $$("[data-role]").forEach(
    (b) => (b.onclick = () => action(b, () => login(b.dataset.role))),
  );
}
async function renderPage() {
  searchGeneration++;
  state.page = navs.some((n) => n[0] === location.hash.slice(1))
    ? location.hash.slice(1)
    : "flights";
  renderNav();
  try {
    if (state.page === "flights") flightsPage();
    else if (state.page === "orders") await ordersPage();
    else if (state.page === "planner") await plannerPage();
    else if (state.page === "agency") await agencyPage();
    else await catalogPage(state.page);
  } catch (e) {
    $("#app").innerHTML = errorBox(e);
  }
}
$("#profile").onclick = roles;
$("#top-orders").onclick = () => navigate("orders");
$("#modal").addEventListener("close", () => clearInterval(modalTimer));
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) {
    const box = e.target.getBoundingClientRect();
    if (
      e.clientX < box.left ||
      e.clientX > box.right ||
      e.clientY < box.top ||
      e.clientY > box.bottom
    )
      e.target.close();
  }
});
$(".support-icon").innerHTML = icon("headphones", 28);
window.addEventListener("hashchange", () => {
  $("#modal").close();
  window.scrollTo({ top: 0 });
  renderPage();
});
try {
  state.meta = await api("/meta");
  state.query.date = addDays(state.meta.today, 1);
  state.actor = (await api("/session")).actor;
  if (!state.actor)
    state.actor = (await post("/session", { role: "traveler" })).actor;
  setRoleLabel();
  await renderPage();
} catch (e) {
  $("#app").innerHTML =
    `<div class="empty-state"><h1>暂时无法连接旅行服务</h1><p>${esc(e.message)}</p><button class="primary" id="retry">重新连接</button></div>`;
  $("#retry").onclick = () => location.reload();
}
