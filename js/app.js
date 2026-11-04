const API_URL = "https://kvantoy.kg07nurislam.workers.dev/api/posts";
const $ = (selector) => document.querySelector(selector);
const state = { posts: [], activePage: "home", currentArticle: null, loading: false };
const STORAGE = { theme: "kvantoy_app_theme", read: "kvantoy_app_read_notifications", known: "kvantoy_app_known_posts" };

function safeRead(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ky-KG", { day:"numeric", month:"long", hour:"2-digit", minute:"2-digit" }).format(date);
}
function articleBody(post) {
  let text = String(post.caption || "");
  const firstLine = text.split(/\r?\n/, 1)[0].trim();
  if (firstLine && firstLine === String(post.title || "").trim()) {
    text = text.slice(text.indexOf("\n") + 1).replace(/^\s+/, "");
  }
  return text;
}
function excerpt(post) {
  return articleBody(post).replace(/\s+/g, " ").trim().slice(0, 190);
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}
function setPage(page) {
  state.activePage = page;
  document.querySelectorAll(".page").forEach(el => el.classList.remove("active"));
  const target = $(`#${page}Page`);
  if (target) target.classList.add("active");
  document.querySelectorAll(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  window.scrollTo({ top: 0, behavior: "instant" });
  if (page === "notifications") renderNotifications();
}
function renderPosts() {
  const list = $("#postsList");
  if (!state.posts.length) {
    list.innerHTML = '<div class="empty-state">Азырынча макалалар табылган жок.</div>';
    return;
  }
  list.innerHTML = state.posts.map(post => `
    <button class="post-card" data-article-id="${escapeHTML(post.id)}">
      <div class="post-meta"><span class="post-tag">МАКАЛА</span><span>${escapeHTML(formatDate(post.created))}</span></div>
      <h3>${escapeHTML(post.title || "Аталышы жок")}</h3>
      <p class="post-excerpt">${escapeHTML(excerpt(post))}</p>
      <span class="post-open">Макаланы окуу <span>→</span></span>
    </button>`).join("");
}
function renderArticle(post) {
  state.currentArticle = post;
  $("#articleContent").innerHTML = `
    <p class="eyebrow">KVANTOY · МАКАЛА</p>
    <h1>${escapeHTML(post.title || "Аталышы жок")}</h1>
    <div class="article-date">${escapeHTML(formatDate(post.created))}</div>
    <div class="article-body">${escapeHTML(articleBody(post))}</div>`;
  setPage("article");
}
function renderNotifications() {
  const now = Date.now();
  const cutoff = now - 72 * 60 * 60 * 1000;
  const recent = state.posts.filter(post => {
    const time = new Date(post.created).getTime();
    return Number.isFinite(time) && time >= cutoff && time <= now + 5 * 60 * 1000;
  });
  const readIds = safeRead(STORAGE.read, []);
  const knownIds = safeRead(STORAGE.known, []);
  $("#notificationsList").innerHTML = recent.map(post => {
    const isRead = readIds.includes(post.id);
    return `<button class="post-card" data-notification-id="${escapeHTML(post.id)}">
      <div class="post-meta"><span class="post-tag">${isRead ? "ОКУЛГАН" : "ЖАҢЫ"}</span><span>${escapeHTML(formatDate(post.created))}</span></div>
      <h3>${escapeHTML(post.title || "Аталышы жок")}</h3>
      <p class="post-excerpt">${escapeHTML(excerpt(post))}</p>
      <span class="post-open">Окуу <span>→</span></span>
    </button>`;
  }).join("");
  $("#notificationsEmpty").classList.toggle("hidden", recent.length !== 0);
  const hasUnread = recent.some(post => !readIds.includes(post.id));
  $("#notificationDot").classList.toggle("hidden", !hasUnread);
  const newIds = recent.map(post => post.id);
  const discovered = newIds.some(id => !knownIds.includes(id));
  if (discovered && knownIds.length) showToast("Жаңы макала жарыяланды");
  localStorage.setItem(STORAGE.known, JSON.stringify([...new Set([...knownIds, ...newIds])]));
}
function markRead(id) {
  const read = safeRead(STORAGE.read, []);
  if (!read.includes(id)) localStorage.setItem(STORAGE.read, JSON.stringify([...read, id]));
}
async function loadPosts({quiet = false} = {}) {
  if (state.loading) return;
  state.loading = true;
  if (!quiet) $("#homeStatus").textContent = "Макалалар жүктөлүүдө…";
  try {
    const response = await fetch(API_URL, { method:"GET", headers:{ "Accept":"application/json" }, cache:"no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.posts)) throw new Error("API жооп форматы туура эмес");
    state.posts = data.posts.filter(p => p && p.id && p.title && p.caption).sort((a,b) => new Date(b.created) - new Date(a.created));
    renderPosts();
    $("#homeStatus").textContent = `${state.posts.length} макала жеткиликтүү`;
    if (state.activePage === "notifications") renderNotifications();
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type:"CACHE_POSTS", posts: state.posts });
    }
  } catch (error) {
    console.error("KVANTOY API:", error);
    $("#homeStatus").textContent = "Интернет байланышын текшериңиз. Кийин кайра аракет кылабыз.";
    if (!state.posts.length) $("#postsList").innerHTML = '<div class="empty-state">Макалаларды жүктөө мүмкүн болгон жок. Интернетти текшерип, кайра жаңылаңыз.</div>';
    showToast("Маалыматтарды алуу мүмкүн болгон жок");
  } finally {
    state.loading = false;
  }
}

document.addEventListener("click", event => {
  const nav = event.target.closest("[data-page]");
  if (nav) { setPage(nav.dataset.page); return; }
  const postButton = event.target.closest("[data-article-id]");
  const notificationButton = event.target.closest("[data-notification-id]");
  const id = postButton?.dataset.articleId || notificationButton?.dataset.notificationId;
  if (id) {
    const post = state.posts.find(item => item.id === id);
    if (post) {
      if (notificationButton) markRead(id);
      renderArticle(post);
    }
  }
});
$("#backHome").addEventListener("click", () => setPage("home"));
$("#refreshButton").addEventListener("click", () => loadPosts());
$("#reloadPosts").addEventListener("click", () => loadPosts());

const themeToggle = $("#themeToggle");
function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  themeToggle.checked = theme === "light";
}
const savedTheme = localStorage.getItem(STORAGE.theme) || "dark";
applyTheme(savedTheme);
themeToggle.addEventListener("change", () => {
  const theme = themeToggle.checked ? "light" : "dark";
  localStorage.setItem(STORAGE.theme, theme);
  applyTheme(theme);
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(console.warn));
}
loadPosts();
setInterval(() => loadPosts({quiet:true}), 5 * 60 * 1000);
