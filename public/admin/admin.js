const state = { auth: null, categories: [], services: [], tab: "stats", adminDetail: null, requestsSubTab: "active", requestDetailId: null };

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
    state.adminDetail = null;
    state.requestDetailId = null;
    renderTab(btn.dataset.tab);
  });
});

async function renderTab(tab) {
  state.tab = tab;
  content.innerHTML = '<p class="muted">Загрузка…</p>';
  try {
    if (tab === "stats") return await renderStats();
    if (tab === "categories") return await renderCategories();
    if (tab === "services") return await renderServices();
    if (tab === "providers") return await renderProviders();
    if (tab === "requests") return await renderRequests();
    if (tab === "reviews") return await renderReviews();
  } catch (e) {
    content.innerHTML = `<p class="error">${e.message}</p>`;
  }
}

// ---------- Аналитика ----------

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString("ru-RU");
}
function statusBadge(status) {
  return `<span class="badge">${esc(status)}</span>`;
}

async function renderStats() {
  if (state.adminDetail) {
    return state.adminDetail.type === "provider"
      ? renderProviderDetail(state.adminDetail.id)
      : renderClientDetail(state.adminDetail.id);
  }

  const [s, providers, clients] = await Promise.all([api("/admin/stats"), api("/admin/providers"), api("/admin/users")]);

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

    <div class="section-head"><h2>Мастера (${providers.length})</h2></div>
    <table>
      <thead><tr><th>ID</th><th>Имя</th><th>Услуги</th><th>Районы</th><th>Рейтинг</th><th>Статус</th><th></th></tr></thead>
      <tbody>
        ${providers
          .map(
            (p) => `<tr class="row-clickable" data-view-provider="${p.id}">
              <td>${p.id}</td>
              <td>${esc(p.user.name)}</td>
              <td>${p.services.map((s) => esc(s.service.name)).join(", ") || "—"}</td>
              <td>${p.areas.map((a) => esc(a.area)).join(", ") || "—"}</td>
              <td>${p.rating.toFixed(1)} (${p.reviewCount})</td>
              <td>${statusBadge(p.blocked ? "заблокирован" : p.verified ? "подтверждён" : "новый")}</td>
              <td>
                <button class="ghost-btn row-action" data-edit-provider="${p.id}">Изменить</button>
                <button class="link-btn row-action" data-del-provider="${p.id}">Удалить</button>
              </td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${providers.length === 0 ? '<p class="muted">Мастеров пока нет.</p>' : ""}

    <div class="section-head"><h2>Клиенты (${clients.length})</h2></div>
    <table>
      <thead><tr><th>ID</th><th>Имя</th><th>Username</th><th>Заявок</th><th>Отзывов оставлено</th><th>Рейтинг клиента</th><th></th></tr></thead>
      <tbody>
        ${clients
          .map(
            (c) => `<tr class="row-clickable" data-view-client="${c.id}">
              <td>${c.id}</td>
              <td>${esc(c.name)}</td>
              <td>${c.username ? "@" + esc(c.username) : "—"}</td>
              <td>${c._count.requests}</td>
              <td>${c._count.reviews}</td>
              <td>${c._count.clientReviews ? `★ ${c.rating.toFixed(1)} (${c._count.clientReviews})` : "—"}</td>
              <td>
                <button class="ghost-btn row-action" data-edit-client="${c.id}">Изменить</button>
                <button class="link-btn row-action" data-del-client="${c.id}">Удалить</button>
              </td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
    ${clients.length === 0 ? '<p class="muted">Клиентов пока нет.</p>' : ""}
  `;

  document.querySelectorAll("[data-view-provider]").forEach((row) => {
    row.addEventListener("click", () => {
      state.adminDetail = { type: "provider", id: Number(row.dataset.viewProvider) };
      renderTab("stats");
    });
  });
  document.querySelectorAll("[data-edit-provider]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openProviderEdit(Number(btn.dataset.editProvider));
    });
  });
  document.querySelectorAll("[data-del-provider]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Удалить мастера? Также удалятся его услуги, районы, отклики и отзывы.")) return;
      await api(`/admin/providers/${btn.dataset.delProvider}`, { method: "DELETE" });
      renderTab("stats");
    });
  });
  document.querySelectorAll("[data-view-client]").forEach((row) => {
    row.addEventListener("click", () => {
      state.adminDetail = { type: "client", id: Number(row.dataset.viewClient) };
      renderTab("stats");
    });
  });
  document.querySelectorAll("[data-edit-client]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openClientEdit(Number(btn.dataset.editClient));
    });
  });
  document.querySelectorAll("[data-del-client]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("Удалить клиента? Также удалятся его заявки и отзывы.")) return;
      await api(`/admin/users/${btn.dataset.delClient}`, { method: "DELETE" });
      renderTab("stats");
    });
  });
}

// ---------- Детальная карточка мастера ----------

async function renderProviderDetail(id) {
  const p = await api(`/admin/providers/${id}`);
  const accepted = p.offers.filter((o) => o.status === "accepted").length;
  const declined = p.offers.filter((o) => o.status === "declined").length;
  const pending = p.offers.filter((o) => o.status === "pending").length;

  content.innerHTML = `
    <button class="link-btn" id="back-to-stats">← Ко всем мастерам и клиентам</button>
    <div class="section-head"><h2>${esc(p.user.name)}</h2>
      <div>
        <button class="ghost-btn" id="detail-edit">Изменить</button>
        <button class="link-btn" id="detail-delete">Удалить</button>
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
        <tr><td>Telegram ID</td><td>${esc(p.user.telegramId)}</td></tr>
        <tr><td>Username</td><td>${p.user.username ? "@" + esc(p.user.username) : "—"}</td></tr>
        <tr><td>Услуги</td><td>${p.services.map((s) => esc(s.service.name)).join(", ") || "—"}</td></tr>
        <tr><td>Районы</td><td>${p.areas.map((a) => esc(a.area)).join(", ") || "—"}</td></tr>
        <tr><td>Цена от</td><td>${p.priceFrom ? p.priceFrom + " ₾" : "—"}</td></tr>
        <tr><td>О себе</td><td>${esc(p.description) || "—"}</td></tr>
        <tr><td>Статус</td><td>${statusBadge(p.blocked ? "заблокирован" : p.verified ? "подтверждён" : "новый")}</td></tr>
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

  $("#back-to-stats").addEventListener("click", () => {
    state.adminDetail = null;
    renderTab("stats");
  });
  $("#detail-edit").addEventListener("click", () => openProviderEdit(id));
  $("#detail-delete").addEventListener("click", async () => {
    if (!confirm("Удалить мастера? Также удалятся его услуги, районы, отклики и отзывы.")) return;
    await api(`/admin/providers/${id}`, { method: "DELETE" });
    state.adminDetail = null;
    renderTab("stats");
  });
}

// ---------- Детальная карточка клиента ----------

async function renderClientDetail(id) {
  const c = await api(`/admin/users/${id}`);

  content.innerHTML = `
    <button class="link-btn" id="back-to-stats">← Ко всем мастерам и клиентам</button>
    <div class="section-head"><h2>${esc(c.name)}</h2>
      <div>
        <button class="ghost-btn" id="detail-edit">Изменить</button>
        <button class="link-btn" id="detail-delete">Удалить</button>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="value">${c.requests.length}</div><div class="label">Заявок</div></div>
      <div class="stat-card"><div class="value">${c.reviews.length}</div><div class="label">Отзывов оставлено</div></div>
      <div class="stat-card"><div class="value">${c.clientReviews.length ? `★ ${c.rating.toFixed(1)}` : "—"}</div><div class="label">Рейтинг клиента (${c.clientReviews.length})</div></div>
    </div>

    <div class="section-head"><h2>Профиль</h2></div>
    <table>
      <tbody>
        <tr><td>Telegram ID</td><td>${esc(c.telegramId)}</td></tr>
        <tr><td>Username</td><td>${c.username ? "@" + esc(c.username) : "—"}</td></tr>
        <tr><td>Регистрация</td><td>${fmtDate(c.createdAt)}</td></tr>
      </tbody>
    </table>

    <div class="section-head"><h2>История заявок</h2></div>
    <table>
      <thead><tr><th>Услуга</th><th>Район</th><th>Статус</th><th>Откликов</th><th>Дата</th></tr></thead>
      <tbody>
        ${c.requests
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
    ${c.requests.length === 0 ? '<p class="muted">Заявок пока нет.</p>' : ""}

    <div class="section-head"><h2>Отзывы клиента</h2></div>
    <table>
      <thead><tr><th>Мастер</th><th>Оценка</th><th>Текст</th><th>Дата</th></tr></thead>
      <tbody>
        ${c.reviews
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
    ${c.reviews.length === 0 ? '<p class="muted">Отзывов пока нет.</p>' : ""}

    <div class="section-head"><h2>Отзывы о клиенте (от мастеров)</h2></div>
    <table>
      <thead><tr><th>Мастер</th><th>Оценка</th><th>Текст</th><th>Дата</th><th></th></tr></thead>
      <tbody>
        ${c.clientReviews
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
    ${c.clientReviews.length === 0 ? '<p class="muted">Отзывов о клиенте пока нет.</p>' : ""}
  `;

  document.querySelectorAll("[data-del-client-review]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Удалить отзыв о клиенте?")) return;
      await api(`/admin/client-reviews/${btn.dataset.delClientReview}`, { method: "DELETE" });
      renderClientDetail(id);
    });
  });

  $("#back-to-stats").addEventListener("click", () => {
    state.adminDetail = null;
    renderTab("stats");
  });
  $("#detail-edit").addEventListener("click", () => openClientEdit(id));
  $("#detail-delete").addEventListener("click", async () => {
    if (!confirm("Удалить клиента? Также удалятся его заявки и отзывы.")) return;
    await api(`/admin/users/${id}`, { method: "DELETE" });
    state.adminDetail = null;
    renderTab("stats");
  });
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
    renderTab("stats");
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
    renderTab("stats");
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

// ---------- Мастера ----------

async function renderProviders() {
  const [providers, services] = await Promise.all([api("/admin/providers"), api("/services")]);
  content.innerHTML = `
    <div class="section-head"><h2>Мастера</h2></div>
    <div class="form-grid">
      <input id="pr-name" placeholder="Имя мастера" />
      <input id="pr-telegram" placeholder="Telegram ID (число)" />
      <input id="pr-username" placeholder="Username (необязательно)" />
      <input id="pr-price" placeholder="Цена от (₾)" type="number" />
      <select id="pr-service">
        ${services.map((s) => `<option value="${s.id}">${s.name}</option>`).join("")}
      </select>
      <input id="pr-areas" placeholder="Районы через запятую: Ваке, Сабуртало" />
      <textarea id="pr-desc" class="full" placeholder="Короткое описание"></textarea>
      <button class="primary-btn full" id="pr-add">Добавить мастера</button>
    </div>
    <table>
      <thead><tr><th>ID</th><th>Имя</th><th>Услуги</th><th>Районы</th><th>Рейтинг</th><th>Статус</th><th></th></tr></thead>
      <tbody>
        ${providers
          .map(
            (p) => `<tr>
              <td>${p.id}</td>
              <td>${p.user.name}</td>
              <td>${p.services.map((s) => s.service.name).join(", ")}</td>
              <td>${p.areas.map((a) => a.area).join(", ")}</td>
              <td>${p.rating.toFixed(1)} (${p.reviewCount})</td>
              <td>
                <span class="badge">${p.blocked ? "заблокирован" : p.verified ? "подтверждён" : "новый"}</span>
              </td>
              <td>
                ${
                  p.blocked
                    ? `<button class="link-btn" data-unblock="${p.id}">Разблокировать</button>`
                    : `<button class="link-btn" data-block="${p.id}">Заблокировать</button>`
                }
              </td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  $("#pr-add").addEventListener("click", async () => {
    const name = $("#pr-name").value.trim();
    const telegramId = $("#pr-telegram").value.trim();
    if (!name || !telegramId) return alert("Имя и Telegram ID обязательны");
    const payload = {
      name,
      telegramId,
      username: $("#pr-username").value.trim() || undefined,
      priceFrom: $("#pr-price").value ? Number($("#pr-price").value) : undefined,
      description: $("#pr-desc").value.trim() || undefined,
      serviceIds: [Number($("#pr-service").value)],
      areas: $("#pr-areas").value.split(",").map((a) => a.trim()).filter(Boolean),
    };
    await api("/admin/providers", { method: "POST", body: JSON.stringify(payload) });
    renderProviders();
  });

  document.querySelectorAll("[data-block]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/admin/providers/${btn.dataset.block}`, { method: "PUT", body: JSON.stringify({ blocked: true }) });
      renderProviders();
    });
  });
  document.querySelectorAll("[data-unblock]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api(`/admin/providers/${btn.dataset.unblock}`, { method: "PUT", body: JSON.stringify({ blocked: false }) });
      renderProviders();
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
