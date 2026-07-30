const state = { auth: null, categories: [], services: [], tab: "stats" };

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
    renderTab(btn.dataset.tab);
  });
});

async function renderTab(tab) {
  state.tab = tab;
  content.innerHTML = '<p class="muted">Загрузка…</p>';
  try {
    if (tab === "stats") return renderStats();
    if (tab === "categories") return renderCategories();
    if (tab === "services") return renderServices();
    if (tab === "providers") return renderProviders();
    if (tab === "requests") return renderRequests();
    if (tab === "reviews") return renderReviews();
  } catch (e) {
    content.innerHTML = `<p class="error">${e.message}</p>`;
  }
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
  `;
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
  const requests = await api("/admin/requests");
  content.innerHTML = `
    <div class="section-head"><h2>Заявки</h2></div>
    <table>
      <thead><tr><th>ID</th><th>Клиент</th><th>Услуга</th><th>Район</th><th>Статус</th><th>Откликов</th></tr></thead>
      <tbody>
        ${requests
          .map(
            (r) => `<tr>
              <td>${r.id}</td>
              <td>${r.user.name}</td>
              <td>${r.service.name}</td>
              <td>${r.area || "—"}</td>
              <td><span class="badge">${r.status}</span></td>
              <td>${r.offers.length}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

// ---------- Отзывы ----------

async function renderReviews() {
  const reviews = await api("/admin/reviews");
  content.innerHTML = `
    <div class="section-head"><h2>Отзывы</h2></div>
    <table>
      <thead><tr><th>ID</th><th>Мастер</th><th>Клиент</th><th>Оценка</th><th>Теги</th><th></th></tr></thead>
      <tbody>
        ${reviews
          .map(
            (r) => `<tr>
              <td>${r.id}</td>
              <td>${r.provider.user.name}</td>
              <td>${r.user.name}</td>
              <td>${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</td>
              <td>${(r.tags || []).join(", ")}</td>
              <td><button class="link-btn" data-del-review="${r.id}">Удалить</button></td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  document.querySelectorAll("[data-del-review]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Удалить отзыв?")) return;
      await api(`/admin/reviews/${btn.dataset.delReview}`, { method: "DELETE" });
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
