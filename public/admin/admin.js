const state = {
  auth: null,
  categories: [],
  services: [],
  tab: "stats",
  userDetailId: null,
  userDetailTab: "client",
  userFilters: { search: "", service: "", area: "", minRating: "", status: "" },
  requestsSubTab: "active",
  requestDetailId: null,
};

const $ = (sel) => document.querySelector(sel);
const content = $("#content");

// ---------- Авторизация ----------

function saveAuth(user, pass) {
  state.auth = "Basic " + btoa(`${user}:${pass}`);
  sessionStorage.setItem("admin_auth", state.auth);
}
function loadAuth() {
  const saved = sessionStorage.getItem("admin_auth");
  if (saved) state.auth = saved;
}
function clearAuth() {
  state.auth = null;
  sessionStorage.removeItem("admin_auth");
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: state.auth,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    clearAuth();
    showLogin("Сессия истекла, войдите снова");
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Ошибка ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

function showLogin(err) {
  $("#login-screen").classList.remove("hidden");
  $("#app").classList.add("hidden");
  $("#login-error").textContent = err || "";
}
function showApp() {
  $("#login-screen").classList.add("hidden");
  $("#app").classList.remove("hidden");
}

$("#login-btn").addEventListener("click", async () => {
  const user = $("#login-user").value.trim();
  const pass = $("#login-pass").value;
  saveAuth(user, pass);
  try {
    await api("/admin/stats");
    showApp();
    renderTab("stats");
  } catch (e) {
    showLogin("Неверный логин или пароль");
  }
});

$("#logout-btn").addEventListener("click", () => {
  clearAuth();
  showLogin();
});

// ---------- Табы ----------

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    state.userDetailId = null;
    state.requestDetailId = null;
    renderTab(btn.dataset.tab);
  });
});

async function renderTab(tab) {
  state.tab = tab;
  content.innerHTML = '<p class="muted">Загрузка…</p>';
  try {
    if (tab === "stats") return await renderStats();
    if (tab === "users") return await renderUsers();
    if (tab === "categories") return await renderCategories();
    if (tab === "services") return await renderServices();
    if (tab === "requests") return await renderRequests();
    if (tab === "reviews") return await renderReviews();
    if (tab === "monetization") return await renderMonetization();
    if (tab === "partners") return await renderPartners();
    if (tab === "support") return await renderSupport();
  } catch (e) {
    content.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

// ---------- Общие хелперы ----------

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString("ru-RU");
}
function statusBadge(status) {
  return `<span class="badge">${esc(status)}</span>`;
}

// blocked — модерация админом, active === false — мастер сам нажал
// «Удалить аккаунт» (мягкое удаление, см. providersService.deactivate).
function providerStatusLabel(p) {
  if (p.blocked) return "заблокирован";
  if (p.active === false) return "деактивирован (удалил себя)";
  return p.verified ? "подтверждён" : "новый";
}

// Симметрично providerStatusLabel — blocked теперь и у User (см. схему), не
// путать с active === false (клиент сам нажал «Удалить аккаунт»).
function clientStatusLabel(u) {
  if (u.blocked) return "заблокирован";
  if (u.active === false) return "деактивирован (удалил себя)";
  return "активен";
}

// Тариф — считаем на лету так же, как getEffectiveTier на бэкенде: pro
// только если явно выставлен И срок ещё не истёк, иначе показываем Free.
function isEffectivelyPro(p) {
  return p.tier === "pro" && p.tierUntil && new Date(p.tierUntil).getTime() > Date.now();
}
function tierLabel(p) {
  return isEffectivelyPro(p) ? `Pro до ${fmtDate(p.tierUntil)}` : "Free";
}

// ---------- Аналитика ----------

async function renderStats() {
  const s = await api("/admin/stats");

  content.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><div class="value">${s.users}</div><div class="label">Пользователей</div></div>
      <div class="stat-card"><div class="value">${s.providers}</div><div class="label">Мастеров</div></div>
      <div class="stat-card"><div class="value">${s.requests}</div><div class="label">Заявок</div></div>
      <div class="stat-card"><div class="value">${s.offers}</div><div class="label">Откликов</div></div>
      <div class="stat-card"><div class="value">${s.reviews}</div><div class="label">Отзывов</div></div>
      <div class="stat-card"><div class="value">${s.conversion.requestToOffer}%</div><div class="label">Заявка → отклик</div></div>
      <div class="stat-card"><div class="value">${s.conversion.requestToOrder}%</div><div class="label">Заявка → заказ</div></div>
    </div>

    <div class="section-head"><h2>Динамика</h2></div>
    <table>
      <thead><tr><th></th><th>Новых клиентов</th><th>Новых мастеров</th><th>Новых заявок</th></tr></thead>
      <tbody>
        <tr><td>За 7 дней</td><td>+${s.growth.last7.users}</td><td>+${s.growth.last7.providers}</td><td>+${s.growth.last7.requests}</td></tr>
        <tr><td>За 30 дней</td><td>+${s.growth.last30.users}</td><td>+${s.growth.last30.providers}</td><td>+${s.growth.last30.requests}</td></tr>
      </tbody>
    </table>

    <div class="section-head"><h2>Незакрытый спрос</h2></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="value">${s.unmetDemand.openNoOffers}</div><div class="label">Открытых заявок без откликов</div></div>
      <div class="stat-card"><div class="value">${s.unmetDemand.avgAcceptHours ?? "—"}${s.unmetDemand.avgAcceptHours !== null ? " ч" : ""}</div><div class="label">Среднее время до принятия отклика</div></div>
      <div class="stat-card"><div class="value">${s.repeatClients}</div><div class="label">Клиентов с повторными заявками</div></div>
    </div>

    <div class="section-head"><h2>Заявки по статусам</h2></div>
    <table>
      <thead><tr><th>Статус</th><th>Количество</th></tr></thead>
      <tbody>
        ${["open", "matched", "completed", "cancelled"]
          .map((st) => `<tr><td>${statusBadge(st)}</td><td>${s.requestsByStatus[st] || 0}</td></tr>`)
          .join("")}
      </tbody>
    </table>

    <div class="section-head"><h2>Топ услуг по спросу</h2></div>
    <table>
      <thead><tr><th>Услуга</th><th>Заявок</th></tr></thead>
      <tbody>${s.demand.topServices.map((t) => `<tr><td>${esc(t.name)}</td><td>${t.count}</td></tr>`).join("")}</tbody>
    </table>
    ${s.demand.topServices.length === 0 ? '<p class="muted">Данных пока нет.</p>' : ""}

    <div class="section-head"><h2>Топ районов по спросу</h2></div>
    <table>
      <thead><tr><th>Район</th><th>Заявок</th></tr></thead>
      <tbody>${s.demand.topAreas.map((t) => `<tr><td>${esc(t.area)}</td><td>${t.count}</td></tr>`).join("")}</tbody>
    </table>
    ${s.demand.topAreas.length === 0 ? '<p class="muted">Данных пока нет.</p>' : ""}
  `;
}

// ---------- Пользователи (клиенты + мастера в одном списке) ----------

// Один и тот же человек (telegramId) может быть и клиентом, и мастером —
// это один User, Provider у него просто дополнительная связанная запись
// (или её нет). Поэтому список строится по User, а не по двум разным
// таблицам, как было раньше (стата отдельно «Мастера», отдельно «Клиенты»).
function userRoleBadges(u) {
  const isClient = u.entryRole === "client" || u._count.requests > 0 || u._count.reviews > 0;
  const isMaster = !!u.provider;
  const badges = [];
  if (isClient) badges.push('<span class="badge">клиент</span>');
  if (isMaster) badges.push('<span class="badge badge-master">мастер</span>');
  if (!badges.length) badges.push('<span class="badge">—</span>');
  return badges.join(" ");
}

function userOverallStatusBadges(u) {
  const parts = [];
  if (u.blocked) parts.push(statusBadge("клиент: заблокирован"));
  else if (u.active === false) parts.push(statusBadge("клиент: деактивирован"));
  if (u.provider) {
    if (u.provider.blocked) parts.push(statusBadge("мастер: заблокирован"));
    else if (u.provider.active === false) parts.push(statusBadge("мастер: деактивирован"));
    else parts.push(statusBadge(u.provider.verified ? "мастер: подтверждён" : "мастер: новый"));
  }
  if (!parts.length) parts.push(statusBadge("активен"));
  return parts.join(" ");
}

function applyUserFilters(users) {
  const f = state.userFilters;
  return users.filter((u) => {
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = `${u.name} ${u.username || ""} ${u.telegramId}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.service && (!u.provider || !u.provider.services.some((s) => s.serviceId === Number(f.service)))) return false;
    if (f.area && (!u.provider || !u.provider.areas.some((a) => a.area === f.area))) return false;
    if (f.minRating) {
      const min = Number(f.minRating);
      const masterOk = u.provider && u.provider.rating >= min;
      const clientOk = u.rating >= min;
      if (!masterOk && !clientOk) return false;
    }
    if (f.status === "blocked" && !u.blocked && !u.provider?.blocked) return false;
    if (f.status === "deactivated" && u.active !== false && u.provider?.active !== false) return false;
    if (f.status === "active") {
      const clientActive = !u.blocked && u.active !== false;
      const masterActive = u.provider ? !u.provider.blocked && u.provider.active !== false : false;
      if (!clientActive && !masterActive) return false;
    }
    return true;
  });
}

function usersTableHtml(filtered, total) {
  return `
    <div class="section-head"><h2>Пользователи (${filtered.length} из ${total})</h2></div>
    <table>
      <thead><tr><th>ID</th><th>Имя</th><th>Роли</th><th>Услуги</th><th>Районы</th><th>Рейтинг</th><th>Статус</th></tr></thead>
      <tbody>
        ${filtered
          .map(
            (u) => `<tr class="row-clickable" data-view-user="${u.id}">
              <td>${u.id}</td>
              <td>${esc(u.name)}${u.username ? ` · @${esc(u.username)}` : ""}</td>
              <td>${userRoleBadges(u)}</td>
              <td>${u.provider ? u.provider.services.map((s) => esc(s.service.name)).join(", ") || "—" : "—"}</td>
              <td>${u.provider ? u.provider.areas.map((a) => esc(a.area)).join(", ") || "—" : "—"}</td>
              <td>${u.provider ? `★${u.provider.rating.toFixed(1)}` : u.clientReviews?.length || u._count.clientReviews ? `★${u.rating.toFixed(1)}` : "—"}</td>
              <td>${userOverallStatusBadges(u)}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${filtered.length === 0 ? '<p class="muted">Никого не найдено.</p>' : ""}
  `;
}

async function renderUsers() {
  if (state.userDetailId) return renderUserDetail(state.userDetailId);

  const [users, services] = await Promise.all([api("/admin/users"), api("/services")]);

  const areasSet = new Set();
  users.forEach((u) => u.provider?.areas.forEach((a) => areasSet.add(a.area)));
  const areas = Array.from(areasSet).sort();
  const f = state.userFilters;

  content.innerHTML = `
    <div class="section-head"><h2>Добавить мастера</h2></div>
    <div class="form-grid">
      <input id="um-name" placeholder="Имя мастера" />
      <input id="um-telegram" placeholder="Telegram ID (число)" />
      <input id="um-username" placeholder="Username (необязательно)" />
      <input id="um-price" placeholder="Цена от (₾)" type="number" />
      <select id="um-service">
        ${services.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}
      </select>
      <input id="um-areas" placeholder="Районы через запятую: Ваке, Сабуртало" />
      <textarea id="um-desc" class="full" placeholder="Короткое описание"></textarea>
      <button class="primary-btn full" id="um-add">Добавить мастера</button>
    </div>

    <div class="filter-bar">
      <input id="uf-search" placeholder="Поиск: имя, username, telegram id" value="${esc(f.search)}" />
      <select id="uf-service">
        <option value="">Все услуги</option>
        ${services.map((s) => `<option value="${s.id}" ${String(f.service) === String(s.id) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
      </select>
      <select id="uf-area">
        <option value="">Все районы</option>
        ${areas.map((a) => `<option value="${esc(a)}" ${f.area === a ? "selected" : ""}>${esc(a)}</option>`).join("")}
      </select>
      <input id="uf-rating" type="number" min="0" max="5" step="0.5" placeholder="Рейтинг от" value="${esc(f.minRating)}" />
      <select id="uf-status">
        <option value="">Любой статус</option>
        <option value="active" ${f.status === "active" ? "selected" : ""}>Активен</option>
        <option value="blocked" ${f.status === "blocked" ? "selected" : ""}>Заблокирован</option>
        <option value="deactivated" ${f.status === "deactivated" ? "selected" : ""}>Деактивирован</option>
      </select>
      <button class="ghost-btn" id="uf-reset">Сбросить</button>
    </div>

    <div id="users-table-area"></div>
  `;

  function refresh() {
    const filtered = applyUserFilters(users);
    $("#users-table-area").innerHTML = usersTableHtml(filtered, users.length);
    document.querySelectorAll("[data-view-user]").forEach((row) => {
      row.addEventListener("click", () => {
        state.userDetailId = Number(row.dataset.viewUser);
        state.userDetailTab = "client";
        renderTab("users");
      });
    });
  }
  refresh();

  $("#uf-search").addEventListener("input", () => {
    state.userFilters.search = $("#uf-search").value;
    refresh();
  });
  $("#uf-service").addEventListener("change", () => {
    state.userFilters.service = $("#uf-service").value;
    refresh();
  });
  $("#uf-area").addEventListener("change", () => {
    state.userFilters.area = $("#uf-area").value;
    refresh();
  });
  $("#uf-rating").addEventListener("input", () => {
    state.userFilters.minRating = $("#uf-rating").value;
    refresh();
  });
  $("#uf-status").addEventListener("change", () => {
    state.userFilters.status = $("#uf-status").value;
    refresh();
  });
  $("#uf-reset").addEventListener("click", () => {
    state.userFilters = { search: "", service: "", area: "", minRating: "", status: "" };
    renderTab("users");
  });

  $("#um-add").addEventListener("click", async () => {
    const name = $("#um-name").value.trim();
    const telegramId = $("#um-telegram").value.trim();
    if (!name || !telegramId) return alert("Имя и Telegram ID обязательны");
    const payload = {
      name,
      telegramId,
      username: $("#um-username").value.trim() || undefined,
      priceFrom: $("#um-price").value ? Number($("#um-price").value) : undefined,
      description: $("#um-desc").value.trim() || undefined,
      serviceIds: [Number($("#um-service").value)],
      areas: $("#um-areas").value.split(",").map((a) => a.trim()).filter(Boolean),
    };
    try {
      await api("/admin/providers", { method: "POST", body: JSON.stringify(payload) });
      renderTab("users");
    } catch (e) {
      alert(e.message);
    }
  });
}

// ---------- Детальная карточка пользователя: вкладки «Клиент»/«Мастер» ----------

async function renderUserDetail(id) {
  const u = await api(`/admin/users/${id}`);
  const tab = state.userDetailTab || "client";

  content.innerHTML = `
    <button class="link-btn" id="back-to-users">← Ко всем пользователям</button>
    <div class="section-head"><h2>${esc(u.name)}</h2></div>
    <div class="tabs" style="padding: 0; margin-bottom: 14px; border-bottom: none;">
      <button class="tab-btn ${tab === "client" ? "is-active" : ""}" data-user-sub="client">Клиент</button>
      <button class="tab-btn ${tab === "master" ? "is-active" : ""}" data-user-sub="master">Мастер${u.provider ? "" : " (нет профиля)"}</button>
    </div>
    <div id="user-detail-body">${tab === "client" ? renderUserClientTabHtml(u) : renderUserMasterTabHtml(u)}</div>
  `;

  $("#back-to-users").addEventListener("click", () => {
    state.userDetailId = null;
    renderTab("users");
  });
  document.querySelectorAll("[data-user-sub]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.userDetailTab = btn.dataset.userSub;
      renderUserDetail(id);
    });
  });

  wireUserDetailActions(u, tab);
}

function renderUserClientTabHtml(u) {
  return `
    <div class="section-head">
      <h2 style="font-size:14px;color:var(--muted);">Профиль клиента</h2>
      <div>
        <button class="ghost-btn row-action" id="client-edit">Изменить</button>
        <button class="ghost-btn row-action" id="client-toggle-block">${u.blocked ? "Разблокировать" : "Заблокировать"}</button>
        <button class="link-btn" id="client-delete">Удалить</button>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="value">${u.requests.length}</div><div class="label">Заявок</div></div>
      <div class="stat-card"><div class="value">${u.reviews.length}</div><div class="label">Отзывов оставлено</div></div>
      <div class="stat-card"><div class="value">${u.clientReviews.length ? `★ ${u.rating.toFixed(1)}` : "—"}</div><div class="label">Рейтинг клиента (${u.clientReviews.length})</div></div>
    </div>

    <div class="section-head"><h2>Профиль</h2></div>
    <table>
      <tbody>
        <tr><td>Telegram ID</td><td>${esc(u.telegramId)}</td></tr>
        <tr><td>Username</td><td>${u.username ? "@" + esc(u.username) : "—"}</td></tr>
        <tr><td>Статус</td><td>${statusBadge(clientStatusLabel(u))}</td></tr>
        <tr><td>Регистрация</td><td>${fmtDate(u.createdAt)}</td></tr>
      </tbody>
    </table>

    <div class="section-head"><h2>История заявок</h2></div>
    <table>
      <thead><tr><th>Услуга</th><th>Район</th><th>Статус</th><th>Откликов</th><th>Дата</th></tr></thead>
      <tbody>
        ${u.requests
          .map(
            (r) => `<tr>
              <td>${esc(r.service.name)}</td>
              <td>${esc(r.area) || "—"}</td>
              <td>${statusBadge(r.status)}</td>
              <td>${r.offers.length}</td>
              <td>${fmtDate(r.createdAt)}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${u.requests.length === 0 ? '<p class="muted">Заявок пока нет.</p>' : ""}

    <div class="section-head"><h2>Отзывы клиента (мастерам)</h2></div>
    <table>
      <thead><tr><th>Мастер</th><th>Оценка</th><th>Текст</th><th>Дата</th></tr></thead>
      <tbody>
        ${u.reviews
          .map(
            (r) => `<tr>
              <td>${esc(r.provider.user.name)}</td>
              <td>${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</td>
              <td>${esc(r.text) || "—"}</td>
              <td>${fmtDate(r.createdAt)}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${u.reviews.length === 0 ? '<p class="muted">Отзывов пока нет.</p>' : ""}

    <div class="section-head"><h2>Отзывы о клиенте (от мастеров)</h2></div>
    <table>
      <thead><tr><th>Мастер</th><th>Оценка</th><th>Текст</th><th>Дата</th><th></th></tr></thead>
      <tbody>
        ${u.clientReviews
          .map(
            (r) => `<tr>
              <td>${esc(r.provider.user.name)}</td>
              <td>${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</td>
              <td>${esc(r.text) || "—"}</td>
              <td>${fmtDate(r.createdAt)}</td>
              <td><button class="link-btn row-action" data-del-client-review="${r.id}">Удалить</button></td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${u.clientReviews.length === 0 ? '<p class="muted">Отзывов о клиенте пока нет.</p>' : ""}
  `;
}

function renderUserMasterTabHtml(u) {
  const p = u.provider;
  if (!p) return '<p class="muted">Этот пользователь не зарегистрирован как мастер.</p>';

  const accepted = p.offers.filter((o) => o.status === "accepted").length;
  const declined = p.offers.filter((o) => o.status === "declined").length;
  const pending = p.offers.filter((o) => o.status === "pending").length;

  return `
    <div class="section-head">
      <h2 style="font-size:14px;color:var(--muted);">Профиль мастера</h2>
      <div>
        <button class="ghost-btn row-action" id="master-edit">Изменить</button>
        <button class="ghost-btn row-action" id="master-toggle-block">${p.blocked ? "Разблокировать" : "Заблокировать"}</button>
        <button class="link-btn" id="master-delete">Удалить профиль</button>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="value">${p.rating.toFixed(1)}</div><div class="label">Рейтинг</div></div>
      <div class="stat-card"><div class="value">${p.reviewCount}</div><div class="label">Отзывов</div></div>
      <div class="stat-card"><div class="value">${p.offers.length}</div><div class="label">Откликов всего</div></div>
      <div class="stat-card"><div class="value">${accepted}</div><div class="label">Принято</div></div>
      <div class="stat-card"><div class="value">${declined}</div><div class="label">Отклонено</div></div>
      <div class="stat-card"><div class="value">${pending}</div><div class="label">В ожидании</div></div>
    </div>

    <div class="section-head"><h2>Профиль</h2></div>
    <table>
      <tbody>
        <tr><td>Услуги</td><td>${p.services.map((s) => esc(s.service.name)).join(", ") || "—"}</td></tr>
        <tr><td>Районы</td><td>${p.areas.map((a) => esc(a.area)).join(", ") || "—"}</td></tr>
        <tr><td>Цена от</td><td>${p.priceFrom ? p.priceFrom + " ₾" : "—"}</td></tr>
        <tr><td>О себе</td><td>${esc(p.description) || "—"}</td></tr>
        <tr><td>Статус</td><td>${statusBadge(providerStatusLabel(p))}</td></tr>
        <tr><td>Зарегистрирован</td><td>${fmtDate(p.createdAt)}</td></tr>
      </tbody>
    </table>

    <div class="section-head"><h2>История откликов</h2></div>
    <table>
      <thead><tr><th>Заявка</th><th>Клиент</th><th>Цена</th><th>Статус</th><th>Дата</th></tr></thead>
      <tbody>
        ${p.offers
          .map(
            (o) => `<tr>
              <td>${esc(o.request.service.name)}</td>
              <td>${esc(o.request.user.name)}</td>
              <td>${o.price} ₾</td>
              <td>${statusBadge(o.status)}</td>
              <td>${fmtDate(o.createdAt)}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${p.offers.length === 0 ? '<p class="muted">Откликов пока нет.</p>' : ""}

    <div class="section-head"><h2>Отзывы о мастере</h2></div>
    <table>
      <thead><tr><th>Клиент</th><th>Оценка</th><th>Текст</th><th>Дата</th></tr></thead>
      <tbody>
        ${p.reviews
          .map(
            (r) => `<tr>
              <td>${esc(r.user.name)}</td>
              <td>${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</td>
              <td>${esc(r.text) || "—"}</td>
              <td>${fmtDate(r.createdAt)}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${p.reviews.length === 0 ? '<p class="muted">Отзывов пока нет.</p>' : ""}
  `;
}

function wireUserDetailActions(u, tab) {
  document.querySelectorAll("[data-del-client-review]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Удалить отзыв о клиенте?")) return;
      await api(`/admin/client-reviews/${btn.dataset.delClientReview}`, { method: "DELETE" });
      renderUserDetail(u.id);
    });
  });

  if (tab === "client") {
    $("#client-edit").addEventListener("click", () => openClientEdit(u.id));
    $("#client-toggle-block").addEventListener("click", async () => {
      await api(`/admin/users/${u.id}`, { method: "PUT", body: JSON.stringify({ blocked: !u.blocked }) });
      renderUserDetail(u.id);
    });
    $("#client-delete").addEventListener("click", async () => {
      if (!confirm("Удалить клиента? Также удалятся его заявки и отзывы.")) return;
      await api(`/admin/users/${u.id}`, { method: "DELETE" });
      state.userDetailId = null;
      renderTab("users");
    });
  } else if (u.provider) {
    $("#master-edit").addEventListener("click", () => openProviderEdit(u.provider.id));
    $("#master-toggle-block").addEventListener("click", async () => {
      await api(`/admin/providers/${u.provider.id}`, { method: "PUT", body: JSON.stringify({ blocked: !u.provider.blocked }) });
      renderUserDetail(u.id);
    });
    $("#master-delete").addEventListener("click", async () => {
      if (!confirm("Удалить профиль мастера? Также удалятся его услуги, районы, отклики и отзывы. Клиентский профиль останется.")) return;
      await api(`/admin/providers/${u.provider.id}`, { method: "DELETE" });
      state.userDetailTab = "client";
      renderUserDetail(u.id);
    });
  }
}

// ---------- Модалка редактирования ----------

function showModal(innerHtml) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modal-overlay";
  overlay.innerHTML = `<div class="modal-box">${innerHtml}</div>`;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.body.appendChild(overlay);
}
function closeModal() {
  document.getElementById("modal-overlay")?.remove();
}

async function openProviderEdit(id) {
  const [p, services] = await Promise.all([api(`/admin/providers/${id}`), api("/services")]);
  const byCategory = {};
  services.forEach((s) => {
    const key = s.category ? s.category.name : "Другое";
    (byCategory[key] = byCategory[key] || []).push(s);
  });
  const selectedIds = new Set(p.services.map((s) => s.service.id));

  showModal(`
    <h3>Мастер: ${esc(p.user.name)}</h3>
    <div class="form-grid">
      <input id="edit-name" placeholder="Имя" value="${esc(p.user.name)}" />
      <input id="edit-username" placeholder="Username" value="${esc(p.user.username || "")}" />
      <input id="edit-price" type="number" placeholder="Цена от" value="${p.priceFrom ?? ""}" />
      <label class="checkbox-row"><input type="checkbox" id="edit-verified" ${p.verified ? "checked" : ""} /> Подтверждён</label>
      <label class="checkbox-row full"><input type="checkbox" id="edit-blocked" ${p.blocked ? "checked" : ""} /> Заблокирован</label>
      <textarea id="edit-desc" class="full" placeholder="О себе">${esc(p.description || "")}</textarea>
      <input id="edit-areas" class="full" placeholder="Районы через запятую" value="${esc(p.areas.map((a) => a.area).join(", "))}" />
      <label class="full tms-label-inline">Услуги (можно несколько)</label>
      <select id="edit-services" multiple size="8" class="full">
        ${Object.entries(byCategory)
          .map(
            ([cat, items]) => `<optgroup label="${esc(cat)}">
              ${items.map((s) => `<option value="${s.id}" ${selectedIds.has(s.id) ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
            </optgroup>`
          )
          .join("")}
      </select>
      <button class="ghost-btn" id="edit-cancel">Отмена</button>
      <button class="primary-btn" id="edit-save">Сохранить</button>
    </div>
  `);

  $("#edit-cancel").addEventListener("click", closeModal);
  $("#edit-save").addEventListener("click", async () => {
    const serviceIds = Array.from($("#edit-services").selectedOptions).map((o) => Number(o.value));
    const areas = $("#edit-areas").value.split(",").map((a) => a.trim()).filter(Boolean);
    await api(`/admin/providers/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: $("#edit-name").value.trim(),
        username: $("#edit-username").value.trim(),
        priceFrom: $("#edit-price").value ? Number($("#edit-price").value) : undefined,
        description: $("#edit-desc").value.trim(),
        verified: $("#edit-verified").checked,
        blocked: $("#edit-blocked").checked,
        serviceIds,
        areas,
      }),
    });
    closeModal();
    renderTab("users");
  });
}

async function openClientEdit(id) {
  const c = await api(`/admin/users/${id}`);
  showModal(`
    <h3>Клиент: ${esc(c.name)}</h3>
    <div class="form-grid">
      <input id="edit-client-name" placeholder="Имя" value="${esc(c.name)}" />
      <input id="edit-client-username" placeholder="Username" value="${esc(c.username || "")}" />
      <button class="ghost-btn" id="edit-client-cancel">Отмена</button>
      <button class="primary-btn" id="edit-client-save">Сохранить</button>
    </div>
  `);

  $("#edit-client-cancel").addEventListener("click", closeModal);
  $("#edit-client-save").addEventListener("click", async () => {
    await api(`/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: $("#edit-client-name").value.trim(),
        username: $("#edit-client-username").value.trim(),
      }),
    });
    closeModal();
    renderTab("users");
  });
}

// ---------- Партнёры ----------

// Логотип сжимается в браузере до маленькой картинки и хранится как base64
// прямо в БД (см. Partner.logoImage) — без файлового хранилища на сервере.
// Ресайз важен не столько ради лимита в 300 КБ на бэкенде, сколько чтобы
// случайное фото с телефона (несколько МБ) не раздувало базу.
function resizeImageFile(file, maxDim = 240) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Файл должен быть изображением"));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Не удалось открыть изображение"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function logoPreviewCellHtml(p) {
  return p.logoImage
    ? `<img src="${p.logoImage}" alt="" style="width:28px;height:28px;border-radius:6px;object-fit:cover;" />`
    : p.logoEmoji || "";
}

async function renderPartners() {
  const partners = await api("/admin/partners");
  content.innerHTML = `
    <div class="section-head"><h2>Партнёры</h2></div>
    <p class="muted">Баннеры сторонних бизнесов — показываются клиенту отдельной лентой, не участвуют в подборе мастеров.</p>
    <div class="form-grid">
      <input id="pt-name" placeholder="Название компании" />
      <input id="pt-tag" placeholder="Категория (напр. Грузоперевозки)" />
      <label class="full tms-label-inline">Логотип (картинка, необязательно)</label>
      <input id="pt-logo-file" class="full" type="file" accept="image/*" />
      <img id="pt-logo-preview" style="display:none;width:48px;height:48px;border-radius:10px;object-fit:cover;" />
      <input id="pt-logo" placeholder="Эмодзи-лого, если без картинки (напр. 🚚)" />
      <input id="pt-website" placeholder="Сайт (необязательно)" />
      <input id="pt-telegram" placeholder="Telegram (необязательно)" />
      <input id="pt-area" placeholder="Район (необязательно)" />
      <textarea id="pt-desc" class="full" placeholder="Описание для страницы партнёра"></textarea>
      <input id="pt-offer" class="full" placeholder="Акция/промокод (напр. Скидка 15% по промокоду TMS15)" />
      <button class="primary-btn full" id="pt-add">Добавить партнёра</button>
    </div>
    <table>
      <thead><tr><th>ID</th><th>Лого</th><th>Название</th><th>Категория</th><th>Порядок</th><th>Статус</th><th></th></tr></thead>
      <tbody>
        ${partners
          .map(
            (p) => `<tr>
              <td>${p.id}</td>
              <td>${logoPreviewCellHtml(p)}</td>
              <td>${esc(p.name)}</td>
              <td>${esc(p.tag || "")}</td>
              <td>${p.sortOrder}</td>
              <td>${p.active ? '<span class="badge">активен</span>' : '<span class="badge">скрыт</span>'}</td>
              <td>
                <button class="link-btn" data-edit-pt="${p.id}">Изменить</button>
                <button class="link-btn" data-toggle-pt="${p.id}" data-active="${p.active}">${p.active ? "Скрыть" : "Показать"}</button>
                <button class="link-btn" data-del-pt="${p.id}">Удалить</button>
              </td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${partners.length === 0 ? '<p class="muted">Партнёров пока нет.</p>' : ""}
  `;

  let ptLogoImage = null;
  $("#pt-logo-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) { ptLogoImage = null; $("#pt-logo-preview").style.display = "none"; return; }
    try {
      ptLogoImage = await resizeImageFile(file);
      $("#pt-logo-preview").src = ptLogoImage;
      $("#pt-logo-preview").style.display = "inline-block";
    } catch (err) {
      alert(err.message);
      e.target.value = "";
    }
  });

  $("#pt-add").addEventListener("click", async () => {
    const name = $("#pt-name").value.trim();
    if (!name) return;
    await api("/admin/partners", {
      method: "POST",
      body: JSON.stringify({
        name,
        tag: $("#pt-tag").value.trim() || undefined,
        logoImage: ptLogoImage || undefined,
        logoEmoji: $("#pt-logo").value.trim() || undefined,
        website: $("#pt-website").value.trim() || undefined,
        telegram: $("#pt-telegram").value.trim() || undefined,
        area: $("#pt-area").value.trim() || undefined,
        description: $("#pt-desc").value.trim() || undefined,
        offerText: $("#pt-offer").value.trim() || undefined,
      }),
    });
    renderPartners();
  });

  document.querySelectorAll("[data-edit-pt]").forEach((btn) => {
    btn.addEventListener("click", () => openPartnerEdit(Number(btn.dataset.editPt), partners));
  });
  document.querySelectorAll("[data-toggle-pt]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const active = btn.dataset.active === "true";
      await api(`/admin/partners/${btn.dataset.togglePt}`, { method: "PUT", body: JSON.stringify({ active: !active }) });
      renderPartners();
    });
  });
  document.querySelectorAll("[data-del-pt]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Удалить партнёра?")) return;
      await api(`/admin/partners/${btn.dataset.delPt}`, { method: "DELETE" });
      renderPartners();
    });
  });
}

function openPartnerEdit(id, partners) {
  const p = partners.find((x) => x.id === id);
  if (!p) return;
  showModal(`
    <h3>Партнёр: ${esc(p.name)}</h3>
    <div class="form-grid">
      <input id="edit-pt-name" placeholder="Название" value="${esc(p.name)}" />
      <input id="edit-pt-tag" placeholder="Категория" value="${esc(p.tag || "")}" />
      <label class="full tms-label-inline">Логотип (картинка)</label>
      <input id="edit-pt-logo-file" class="full" type="file" accept="image/*" />
      <img id="edit-pt-logo-preview" src="${p.logoImage || ""}" style="display:${p.logoImage ? "inline-block" : "none"};width:48px;height:48px;border-radius:10px;object-fit:cover;" />
      ${p.logoImage ? '<label class="checkbox-row full"><input type="checkbox" id="edit-pt-logo-remove" /> Удалить текущий логотип</label>' : ""}
      <input id="edit-pt-logo" placeholder="Эмодзи-лого, если без картинки" value="${esc(p.logoEmoji || "")}" />
      <input id="edit-pt-website" placeholder="Сайт" value="${esc(p.website || "")}" />
      <input id="edit-pt-telegram" placeholder="Telegram" value="${esc(p.telegram || "")}" />
      <input id="edit-pt-area" placeholder="Район" value="${esc(p.area || "")}" />
      <input id="edit-pt-sort" type="number" placeholder="Порядок показа (меньше — выше)" value="${p.sortOrder}" />
      <label class="checkbox-row full"><input type="checkbox" id="edit-pt-active" ${p.active ? "checked" : ""} /> Показывать клиентам</label>
      <textarea id="edit-pt-desc" class="full" placeholder="Описание">${esc(p.description || "")}</textarea>
      <input id="edit-pt-offer" class="full" placeholder="Акция/промокод" value="${esc(p.offerText || "")}" />
      <button class="ghost-btn" id="edit-pt-cancel">Отмена</button>
      <button class="primary-btn" id="edit-pt-save">Сохранить</button>
    </div>
  `);

  let editLogoImage = undefined; // undefined — не трогать, null — удалить, строка — новая картинка
  $("#edit-pt-logo-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      editLogoImage = await resizeImageFile(file);
      $("#edit-pt-logo-preview").src = editLogoImage;
      $("#edit-pt-logo-preview").style.display = "inline-block";
      if ($("#edit-pt-logo-remove")) $("#edit-pt-logo-remove").checked = false;
    } catch (err) {
      alert(err.message);
      e.target.value = "";
    }
  });

  $("#edit-pt-cancel").addEventListener("click", closeModal);
  $("#edit-pt-save").addEventListener("click", async () => {
    const removeChecked = $("#edit-pt-logo-remove")?.checked;
    await api(`/admin/partners/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: $("#edit-pt-name").value.trim(),
        tag: $("#edit-pt-tag").value.trim(),
        logoImage: removeChecked ? null : editLogoImage,
        logoEmoji: $("#edit-pt-logo").value.trim(),
        website: $("#edit-pt-website").value.trim(),
        telegram: $("#edit-pt-telegram").value.trim(),
        area: $("#edit-pt-area").value.trim(),
        sortOrder: Number($("#edit-pt-sort").value) || 0,
        active: $("#edit-pt-active").checked,
        description: $("#edit-pt-desc").value.trim(),
        offerText: $("#edit-pt-offer").value.trim(),
      }),
    });
    closeModal();
    renderPartners();
  });
}

// ---------- Категории ----------

async function renderCategories() {
  const categories = await api("/categories");
  state.categories = categories;
  content.innerHTML = `
    <div class="section-head"><h2>Категории</h2></div>
    <div class="form-grid">
      <input id="cat-name" placeholder="Название (например, Ремонт)" />
      <input id="cat-icon" placeholder="Эмодзи-иконка (например, 🔧)" />
      <button class="primary-btn" id="cat-add">Добавить категорию</button>
    </div>
    <table>
      <thead><tr><th>ID</th><th>Иконка</th><th>Название</th><th></th></tr></thead>
      <tbody>
        ${categories
          .map(
            (c) => `<tr>
              <td>${c.id}</td><td>${c.icon || ""}</td><td>${c.name}</td>
              <td><button class="link-btn" data-del-cat="${c.id}">Удалить</button></td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  $("#cat-add").addEventListener("click", async () => {
    const name = $("#cat-name").value.trim();
    const icon = $("#cat-icon").value.trim();
    if (!name) return;
    await api("/admin/categories", { method: "POST", body: JSON.stringify({ name, icon }) });
    renderCategories();
  });

  document.querySelectorAll("[data-del-cat]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Удалить категорию? Связанные услуги нужно удалить отдельно.")) return;
      await api(`/admin/categories/${btn.dataset.delCat}`, { method: "DELETE" });
      renderCategories();
    });
  });
}

// ---------- Услуги ----------

async function renderServices() {
  const [services, categories] = await Promise.all([api("/services"), api("/categories")]);
  state.categories = categories;
  content.innerHTML = `
    <div class="section-head"><h2>Услуги</h2></div>
    <div class="form-grid">
      <select id="svc-cat">
        ${categories.map((c) => `<option value="${c.id}">${c.icon || ""} ${c.name}</option>`).join("")}
      </select>
      <input id="svc-name" placeholder="Название услуги (например, Сантехника)" />
      <button class="primary-btn full" id="svc-add">Добавить услугу</button>
    </div>
    <table>
      <thead><tr><th>ID</th><th>Категория</th><th>Услуга</th><th></th></tr></thead>
      <tbody>
        ${services
          .map(
            (s) => `<tr>
              <td>${s.id}</td><td>${s.category ? s.category.name : s.categoryId}</td><td>${s.name}</td>
              <td><button class="link-btn" data-del-svc="${s.id}">Удалить</button></td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  $("#svc-add").addEventListener("click", async () => {
    const name = $("#svc-name").value.trim();
    const categoryId = Number($("#svc-cat").value);
    if (!name) return;
    await api("/admin/services", { method: "POST", body: JSON.stringify({ name, categoryId }) });
    renderServices();
  });

  document.querySelectorAll("[data-del-svc]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Удалить услугу?")) return;
      await api(`/admin/services/${btn.dataset.delSvc}`, { method: "DELETE" });
      renderServices();
    });
  });
}

// ---------- Заявки ----------

async function renderRequests() {
  if (state.requestDetailId) return renderRequestDetail(state.requestDetailId);

  const requests = await api("/admin/requests");
  const sub = state.requestsSubTab || "active";
  const active = requests.filter((r) => !r.archived);
  const archived = requests.filter((r) => r.archived);
  const list = sub === "archived" ? archived : active;

  content.innerHTML = `
    <div class="section-head"><h2>Заявки</h2></div>
    <div class="tabs" style="padding: 0; margin-bottom: 14px; border-bottom: none;">
      <button class="tab-btn ${sub === "active" ? "is-active" : ""}" data-req-sub="active">Активные (${active.length})</button>
      <button class="tab-btn ${sub === "archived" ? "is-active" : ""}" data-req-sub="archived">Архивные заявки (${archived.length})</button>
    </div>
    <table>
      <thead><tr><th>ID</th><th>Клиент</th><th>Услуга</th><th>Район</th><th>Статус</th><th>Откликов</th><th>Создана</th></tr></thead>
      <tbody>
        ${list
          .map(
            (r) => `<tr class="row-clickable" data-view-request="${r.id}">
              <td>${r.id}</td>
              <td>${esc(r.user.name)}</td>
              <td>${esc(r.service.name)}</td>
              <td>${esc(r.area) || "—"}</td>
              <td>${statusBadge(r.status)}</td>
              <td>${r.offers.length}</td>
              <td>${fmtDate(r.createdAt)}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${list.length === 0 ? `<p class="muted">${sub === "archived" ? "Архив пуст." : "Заявок пока нет."}</p>` : ""}
  `;

  document.querySelectorAll("[data-req-sub]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.requestsSubTab = btn.dataset.reqSub;
      renderTab("requests");
    });
  });
  document.querySelectorAll("[data-view-request]").forEach((row) => {
    row.addEventListener("click", () => {
      state.requestDetailId = Number(row.dataset.viewRequest);
      renderTab("requests");
    });
  });
}

async function renderRequestDetail(id) {
  const r = await api(`/admin/requests/${id}`);
  const accepted = r.offers.find((o) => o.status === "accepted");

  content.innerHTML = `
    <button class="link-btn" id="back-to-requests">← Ко всем заявкам</button>
    <div class="section-head">
      <h2>Заявка №${r.id} ${r.archived ? statusBadge("в архиве") : ""}</h2>
      <div>
        ${r.status !== "completed" ? `<button class="ghost-btn row-action" id="req-complete">Отметить выполненной</button>` : ""}
        ${r.status !== "cancelled" ? `<button class="ghost-btn row-action" id="req-cancel">Отменить заявку</button>` : ""}
        <button class="link-btn" id="req-delete">Удалить</button>
      </div>
    </div>

    <table>
      <tbody>
        <tr><td>Услуга</td><td>${esc(r.service.name)}</td></tr>
        <tr><td>Район</td><td>${esc(r.area) || "—"}</td></tr>
        <tr><td>Срочность</td><td>${esc(r.urgency) || "—"}</td></tr>
        <tr><td>Бюджет</td><td>${r.budget ? r.budget + " ₾" : "—"}</td></tr>
        <tr><td>Описание</td><td>${esc(r.description) || "—"}</td></tr>
        <tr><td>Статус</td><td>${statusBadge(r.status)}</td></tr>
        <tr><td>Кто сделал</td><td>${esc(r.user.name)}${r.user.username ? " (@" + esc(r.user.username) + ")" : ""}</td></tr>
        <tr><td>Кто взял</td><td>${accepted ? esc(accepted.provider.user.name) + " · " + accepted.price + " ₾" : "—"}</td></tr>
        <tr><td>Создана</td><td>${fmtDate(r.createdAt)}</td></tr>
        <tr><td>Обновлена</td><td>${fmtDate(r.updatedAt)}</td></tr>
      </tbody>
    </table>

    <div class="section-head"><h2>История откликов</h2></div>
    <table>
      <thead><tr><th>Мастер</th><th>Цена</th><th>Статус</th><th>Комментарий</th><th>Дата</th></tr></thead>
      <tbody>
        ${r.offers
          .map(
            (o) => `<tr>
              <td>${esc(o.provider.user.name)}</td>
              <td>${o.price} ₾</td>
              <td>${statusBadge(o.status)}</td>
              <td>${esc(o.comment) || "—"}</td>
              <td>${fmtDate(o.createdAt)}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${r.offers.length === 0 ? '<p class="muted">Откликов пока нет.</p>' : ""}
  `;

  $("#back-to-requests").addEventListener("click", () => {
    state.requestDetailId = null;
    renderTab("requests");
  });
  $("#req-complete")?.addEventListener("click", async () => {
    await api(`/admin/requests/${id}/status`, { method: "PUT", body: JSON.stringify({ status: "completed" }) });
    renderRequestDetail(id);
  });
  $("#req-cancel")?.addEventListener("click", async () => {
    await api(`/admin/requests/${id}/status`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
    renderRequestDetail(id);
  });
  $("#req-delete").addEventListener("click", async () => {
    if (!confirm("Удалить заявку целиком? Также удалятся все отклики и отзывы по ней. Это необратимо.")) return;
    await api(`/admin/requests/${id}`, { method: "DELETE" });
    state.requestDetailId = null;
    renderTab("requests");
  });
}

// ---------- Отзывы ----------

async function renderReviews() {
  const [reviews, clientReviews] = await Promise.all([api("/admin/reviews"), api("/admin/client-reviews")]);
  content.innerHTML = `
    <div class="section-head">
      <h2>Отзывы</h2>
      <button class="ghost-btn" id="recompute-ratings">Пересчитать все рейтинги</button>
    </div>
    <p class="muted">На случай, если рейтинг мастера или клиента «завис» на старом значении после удаления отзыва — пересчитывает рейтинги всех мастеров и клиентов заново по фактическим отзывам.</p>

    <div class="section-head"><h2>Отзывы о мастерах (от клиентов)</h2></div>
    <table>
      <thead><tr><th>ID</th><th>Мастер</th><th>Клиент</th><th>Оценка</th><th>Текст</th><th>Дата</th><th></th></tr></thead>
      <tbody>
        ${reviews
          .map(
            (r) => `<tr>
              <td>${r.id}</td>
              <td>${esc(r.provider.user.name)}</td>
              <td>${esc(r.user.name)}</td>
              <td>${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</td>
              <td>${esc(r.text) || "—"}</td>
              <td>${fmtDate(r.createdAt)}</td>
              <td><button class="link-btn" data-del-review="${r.id}">Удалить</button></td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${reviews.length === 0 ? '<p class="muted">Отзывов пока нет.</p>' : ""}

    <div class="section-head"><h2>Отзывы о клиентах (от мастеров)</h2></div>
    <table>
      <thead><tr><th>ID</th><th>Клиент</th><th>Мастер</th><th>Оценка</th><th>Текст</th><th>Дата</th><th></th></tr></thead>
      <tbody>
        ${clientReviews
          .map(
            (r) => `<tr>
              <td>${r.id}</td>
              <td>${esc(r.user.name)}</td>
              <td>${esc(r.provider.user.name)}</td>
              <td>${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</td>
              <td>${esc(r.text) || "—"}</td>
              <td>${fmtDate(r.createdAt)}</td>
              <td><button class="link-btn" data-del-client-review="${r.id}">Удалить</button></td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${clientReviews.length === 0 ? '<p class="muted">Отзывов пока нет.</p>' : ""}
  `;

  $("#recompute-ratings").addEventListener("click", async () => {
    const res = await api("/admin/recompute-ratings", { method: "POST" });
    alert(`Готово: пересчитано мастеров — ${res.providers}, клиентов — ${res.users}.`);
    renderReviews();
  });

  document.querySelectorAll("[data-del-review]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Удалить отзыв?")) return;
      await api(`/admin/reviews/${btn.dataset.delReview}`, { method: "DELETE" });
      renderReviews();
    });
  });
  document.querySelectorAll("[data-del-client-review]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Удалить отзыв?")) return;
      await api(`/admin/client-reviews/${btn.dataset.delClientReview}`, { method: "DELETE" });
      renderReviews();
    });
  });
}

// ---------- Монетизация ----------

async function renderMonetization() {
  const [providers, stats, transactions] = await Promise.all([
    api("/admin/providers"),
    api("/admin/stats"),
    api("/admin/subscriptions/transactions"),
  ]);

  const proCount = providers.filter(isEffectivelyPro).length;
  const freeCount = providers.length - proCount;
  const avgOffers = providers.length ? (stats.offers / providers.length).toFixed(1) : "0";

  content.innerHTML = `
    <div class="section-head"><h2>Монетизация</h2></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="value">${stats.offers}</div><div class="label">Откликов всего</div></div>
      <div class="stat-card"><div class="value">${avgOffers}</div><div class="label">Среднее откликов на мастера</div></div>
      <div class="stat-card"><div class="value">${freeCount}</div><div class="label">Free</div></div>
      <div class="stat-card"><div class="value">${proCount}</div><div class="label">Pro</div></div>
    </div>

    <div class="section-head"><h2>Мастера — тариф и баланс</h2></div>
    <table>
      <thead><tr><th>ID</th><th>Имя</th><th>Тариф</th><th>Баланс</th><th></th></tr></thead>
      <tbody>
        ${providers
          .map(
            (p) => `<tr>
              <td>${p.id}</td>
              <td>${esc(p.user.name)}</td>
              <td>${statusBadge(tierLabel(p))}</td>
              <td>${p.balance} ₾</td>
              <td>
                <button class="ghost-btn row-action" data-topup="${p.id}">Начислить баланс</button>
                <button class="ghost-btn row-action" data-give-pro="${p.id}">Выдать Pro</button>
              </td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${providers.length === 0 ? '<p class="muted">Мастеров пока нет.</p>' : ""}

    <div class="section-head"><h2>Журнал транзакций</h2></div>
    <table>
      <thead><tr><th>Дата</th><th>Мастер</th><th>Тип</th><th>Сумма</th><th>Комментарий</th></tr></thead>
      <tbody>
        ${transactions
          .map(
            (t) => `<tr>
              <td>${fmtDate(t.createdAt)}</td>
              <td>${t.provider ? esc(t.provider.user.name) : "—"}</td>
              <td>${esc(transactionTypeLabel(t.type))}</td>
              <td>${t.amount > 0 ? "+" : ""}${t.amount} ₾</td>
              <td>${esc(t.comment) || "—"}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${transactions.length === 0 ? '<p class="muted">Транзакций пока нет.</p>' : ""}
  `;

  document.querySelectorAll("[data-topup]").forEach((btn) => {
    btn.addEventListener("click", () => openTopUpModal(Number(btn.dataset.topup)));
  });
  document.querySelectorAll("[data-give-pro]").forEach((btn) => {
    btn.addEventListener("click", () => openGiveProModal(Number(btn.dataset.givePro)));
  });
}

function transactionTypeLabel(type) {
  return { topup: "пополнение", subscription: "подписка", lead: "списание за лид", refund: "возврат" }[type] || type;
}

function openTopUpModal(providerId) {
  showModal(`
    <h3>Начислить баланс</h3>
    <div class="form-grid">
      <input id="topup-amount" type="number" min="1" step="1" placeholder="Сумма, ₾" />
      <input id="topup-comment" class="full" placeholder="Комментарий (например, причина начисления)" />
      <button class="ghost-btn" id="topup-cancel">Отмена</button>
      <button class="primary-btn" id="topup-save">Начислить</button>
    </div>
  `);

  $("#topup-cancel").addEventListener("click", closeModal);
  $("#topup-save").addEventListener("click", async () => {
    const amount = Number($("#topup-amount").value);
    if (!Number.isInteger(amount) || amount <= 0) return alert("Сумма должна быть положительным целым числом");
    try {
      await api("/admin/subscriptions/topup", {
        method: "POST",
        body: JSON.stringify({ providerId, amount, comment: $("#topup-comment").value.trim() || undefined }),
      });
      closeModal();
      renderTab("monetization");
    } catch (e) {
      alert(e.message);
    }
  });
}

function openGiveProModal(providerId) {
  showModal(`
    <h3>Выдать Pro</h3>
    <div class="form-grid">
      <input id="pro-months" type="number" min="1" step="1" placeholder="На сколько месяцев" value="1" />
      <button class="ghost-btn" id="pro-cancel">Отмена</button>
      <button class="primary-btn" id="pro-save">Выдать</button>
    </div>
  `);

  $("#pro-cancel").addEventListener("click", closeModal);
  $("#pro-save").addEventListener("click", async () => {
    const months = Number($("#pro-months").value);
    if (!Number.isInteger(months) || months <= 0) return alert("Количество месяцев должно быть положительным целым числом");
    try {
      await api("/admin/subscriptions/pro", { method: "POST", body: JSON.stringify({ providerId, months }) });
      closeModal();
      renderTab("monetization");
    } catch (e) {
      alert(e.message);
    }
  });
}

// ---------- Поддержка ----------

async function renderSupport() {
  const tickets = await api("/admin/support");

  content.innerHTML = `
    <div class="section-head"><h2>Обращения в поддержку (${tickets.length})</h2></div>
    <table>
      <thead><tr><th>№</th><th>От кого</th><th>Роль</th><th>Тема</th><th>Текст</th><th>Дата</th></tr></thead>
      <tbody>
        ${tickets
          .map(
            (t) => `<tr>
              <td>${t.id}</td>
              <td>${esc(t.name)}${t.username ? " (@" + esc(t.username) + ")" : ""}</td>
              <td>${t.role === "provider" ? "мастер" : "клиент"}</td>
              <td>${esc(t.subject) || "—"}</td>
              <td>${esc(t.text)}</td>
              <td>${fmtDate(t.createdAt)}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${tickets.length === 0 ? '<p class="muted">Обращений пока нет.</p>' : ""}
  `;
}

// ---------- Старт ----------

loadAuth();
if (state.auth) {
  api("/admin/stats")
    .then(() => {
      showApp();
      renderTab("stats");
    })
    .catch(() => showLogin());
} else {
  showLogin();
}
