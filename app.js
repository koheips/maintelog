/* メンテログ v3
  変更点
  ・作業内容マスターを 3区分で保持
  ・マスターの表示順入替 上へ 下へ
  ・表示色 任意設定
  ・推奨頻度 日数 をマスターに保持し 次回推奨作業を算出
  ・アプリ名を端末内で変更可能
  ・既存 localStorage 互換を維持
*/

const STORAGE_KEY = "maintelog_rows_v2";      // 互換維持
const TASKS_KEY = "maintelog_tasks_v2";       // 互換維持
const APPNAME_KEY = "maintelog_appname_v3";

const CATS = ["掃除", "洗濯", "その他"];

const defaultTaskNames = [
  "拭き掃除",
  "掃除機",
  "風呂",
  "トイレ",
  "洗濯",
  "庭"
];

const $ = (id) => document.getElementById(id);

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatJP(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${y}/${m}/${d}`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clampColor(hex, fallback) {
  if (typeof hex !== "string") return fallback;
  const v = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  return fallback;
}

function normalizeIntOrNull(raw) {
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 0) return null;
  return i;
}

function daysBetween(isoA, isoB) {
  // isoA <= isoB を想定
  const a = new Date(`${isoA}T00:00:00`);
  const b = new Date(`${isoB}T00:00:00`);
  const ms = b.getTime() - a.getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 86400000);
}

/* rows 互換
  既存: { id, date, nights, tasks:[string], other }
*/
function loadRows() {
  const rows = loadJSON(STORAGE_KEY, []);
  if (!Array.isArray(rows)) return [];
  return rows;
}

function saveRows(rows) {
  saveJSON(STORAGE_KEY, rows);
}

/* tasks master 互換
  v2: [ "トイレ", "風呂", ... ]
  v3: [ { name, cat, freqDays, bg, text }, ... ]
*/
function migrateTasks(raw) {
  if (!raw) return null;

  if (Array.isArray(raw) && raw.every(x => typeof x === "string")) {
    // 区分推測は禁止なので 一律 その他 を既定値として移行
    return raw
      .map(s => String(s).trim())
      .filter(s => s.length > 0)
      .map(s => ({
        name: s,
        cat: "その他",
        freqDays: null,
        bg: "#0f0f0f",
        text: "#f0f0f0"
      }));
  }

  if (Array.isArray(raw) && raw.every(x => x && typeof x === "object" && typeof x.name === "string")) {
    return raw.map(x => ({
      name: String(x.name).trim(),
      cat: CATS.includes(x.cat) ? x.cat : "その他",
      freqDays: normalizeIntOrNull(x.freqDays),
      bg: clampColor(x.bg, "#0f0f0f"),
      text: clampColor(x.text, "#f0f0f0")
    })).filter(x => x.name.length > 0);
  }

  return null;
}

function ensureDefaultTasks() {
  const raw = loadJSON(TASKS_KEY, null);
  const migrated = migrateTasks(raw);

  if (migrated && migrated.length > 0) {
    // unique by name keep first
    const seen = new Set();
    const uniq = [];
    migrated.forEach(t => {
      if (seen.has(t.name)) return;
      seen.add(t.name);
      uniq.push(t);
    });
    saveJSON(TASKS_KEY, uniq);
    return uniq;
  }

  const base = defaultTaskNames.map(s => ({
    name: s,
    cat: "その他",
    freqDays: null,
    bg: "#0f0f0f",
    text: "#f0f0f0"
  }));
  saveJSON(TASKS_KEY, base);
  return base;
}

function loadTasks() {
  const raw = loadJSON(TASKS_KEY, null);
  const migrated = migrateTasks(raw);
  if (migrated && migrated.length > 0) return migrated;
  return ensureDefaultTasks();
}

function saveTasks(tasks) {
  const cleaned = (tasks || [])
    .filter(x => x && typeof x === "object")
    .map(x => ({
      name: String(x.name ?? "").trim(),
      cat: CATS.includes(x.cat) ? x.cat : "その他",
      freqDays: normalizeIntOrNull(x.freqDays),
      bg: clampColor(x.bg, "#0f0f0f"),
      text: clampColor(x.text, "#f0f0f0")
    }))
    .filter(x => x.name.length > 0);

  // unique by name keep first
  const seen = new Set();
  const uniq = [];
  cleaned.forEach(t => {
    if (seen.has(t.name)) return;
    seen.add(t.name);
    uniq.push(t);
  });

  saveJSON(TASKS_KEY, uniq);
  return uniq;
}

/* app name */
function loadAppName() {
  const v = localStorage.getItem(APPNAME_KEY);
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : "メンテログ";
}
function saveAppName(v) {
  const s = String(v ?? "").trim();
  if (s.length === 0) {
    localStorage.removeItem(APPNAME_KEY);
    return "メンテログ";
  }
  localStorage.setItem(APPNAME_KEY, s);
  return s;
}
function applyAppName() {
  const name = loadAppName();
  $("appTitle").textContent = name;
  document.title = name;
  $("appName").value = name;
}

function renderStatus() {
  const rows = loadRows();
  $("status").textContent = `記録 ${rows.length}件`;
}

/* tasks selection */
function tasksByCat(tasks) {
  const map = { "掃除": [], "洗濯": [], "その他": [] };
  tasks.forEach(t => {
    const cat = CATS.includes(t.cat) ? t.cat : "その他";
    map[cat].push(t);
  });
  return map;
}

function renderTaskChips() {
  const tasks = loadTasks();
  const byCat = tasksByCat(tasks);
  const area = $("tasksArea");
  area.innerHTML = "";

  CATS.forEach(cat => {
    const items = byCat[cat] || [];
    const title = document.createElement("div");
    title.className = "groupTitle";
    title.textContent = cat;
    area.appendChild(title);

    const wrap = document.createElement("div");
    wrap.className = "chips";

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = "未設定";
      wrap.appendChild(empty);
    } else {
      items.forEach(t => {
        const label = document.createElement("label");
        label.className = "chip";
        label.setAttribute("data-color", "1");
        label.style.background = t.bg || "#0f0f0f";
        label.style.color = t.text || "#f0f0f0";
        label.style.borderColor = "rgba(255,255,255,0.18)";
        label.innerHTML = `
          <input type="checkbox" value="${escapeHtml(t.name)}" />
          <span>${escapeHtml(t.name)}</span>
        `;
        wrap.appendChild(label);
      });
    }

    area.appendChild(wrap);
  });
}

function getSelectedTasks() {
  const area = $("tasksArea");
  const checks = Array.from(area.querySelectorAll("input[type=checkbox]"));
  return checks.filter(c => c.checked).map(c => c.value);
}

function clearInput() {
  $("date").value = todayISO();
  $("nights").value = "";
  $("other").value = "";
  const area = $("tasksArea");
  Array.from(area.querySelectorAll("input[type=checkbox]")).forEach(c => c.checked = false);
}

/* rows add delete */
function addRow(row) {
  const rows = loadRows();
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  rows.push({ id, ...row });
  saveRows(rows);
  return id;
}

function deleteRow(id) {
  const rows = loadRows();
  const next = rows.filter(r => r.id !== id);
  saveRows(next);
}

function rowSummaryParts(r) {
  const tasks = Array.isArray(r.tasks) ? r.tasks : [];
  const other = String(r.other ?? "").trim();
  const parts = [];
  tasks.forEach(t => parts.push(t));
  if (other.length > 0) parts.push(other);
  return parts;
}

function taskStyleByName(name) {
  const tasks = loadTasks();
  const hit = tasks.find(t => t.name === name);
  if (!hit) return null;
  return { bg: hit.bg || "#0f0f0f", text: hit.text || "#f0f0f0" };
}

let sortMode = "desc";

function renderHistory() {
  const rows = loadRows().slice();
  rows.sort((a, b) => {
    const ad = String(a.date ?? "");
    const bd = String(b.date ?? "");
    if (sortMode === "asc") return ad.localeCompare(bd);
    return bd.localeCompare(ad);
  });

  const body = $("historyBody");
  body.innerHTML = "";

  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="muted">記録なし</td></tr>`;
    return;
  }

  rows.forEach(r => {
    const dateTxt = r.date ? formatJP(r.date) : "日付不明";
    const nightsTxt = (r.nights === 0 || r.nights) ? String(r.nights) : "";
    const parts = rowSummaryParts(r);

    const pills = parts.map(p => {
      const style = taskStyleByName(p);
      if (style) {
        return `<span class="pill" style="background:${escapeHtml(style.bg)};color:${escapeHtml(style.text)}">${escapeHtml(p)}</span>`;
      }
      return `<span class="pill">${escapeHtml(p)}</span>`;
    }).join("");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(dateTxt)}</td>
      <td>${escapeHtml(nightsTxt)}</td>
      <td>${pills || `<span class="muted">空</span>`}</td>
      <td class="right"><button data-del="${escapeHtml(r.id)}" type="button">削除</button></td>
    `;
    body.appendChild(tr);
  });

  Array.from(body.querySelectorAll("button[data-del]")).forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      if (!id) return;
      const ok = confirm("この行を削除");
      if (!ok) return;
      deleteRow(id);
      renderStatus();
      renderHistory();
      renderReco();
    });
  });
}

/* master UI */
function renderMaster() {
  const tasks = loadTasks();
  const box = $("master");
  box.innerHTML = "";

  if (tasks.length === 0) {
    box.innerHTML = `<div class="muted">未設定</div>`;
    return;
  }

  tasks.forEach((t, idx) => {
    const div = document.createElement("div");
    div.className = "masterItem";

    const freqTxt = (t.freqDays && t.freqDays > 0) ? `${t.freqDays}日` : "未設定";

    div.innerHTML = `
      <div class="masterName">${escapeHtml(t.name)}</div>
      <span class="tag">${escapeHtml(t.cat)}</span>
      <span class="tag">頻度 ${escapeHtml(freqTxt)}</span>
      <div class="colorPick">
        <input data-bg="${idx}" type="color" value="${escapeHtml(clampColor(t.bg, "#0f0f0f"))}" />
        <input data-text="${idx}" type="color" value="${escapeHtml(clampColor(t.text, "#f0f0f0"))}" />
      </div>

      <button class="small" data-up="${idx}" type="button">上へ</button>
      <button class="small" data-down="${idx}" type="button">下へ</button>
      <button class="small" data-edit="${idx}" type="button">編集</button>
      <button class="small danger" data-del-task="${idx}" type="button">削除</button>
    `;
    box.appendChild(div);
  });

  // delete
  Array.from(box.querySelectorAll("button[data-del-task]")).forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-del-task"));
      if (!Number.isFinite(i)) return;
      const tasks2 = loadTasks();
      const target = tasks2[i];
      if (!target) return;
      const ok = confirm("選択肢を削除");
      if (!ok) return;
      tasks2.splice(i, 1);
      saveTasks(tasks2);
      renderTaskChips();
      renderMaster();
      renderReco();
    });
  });

  // move
  Array.from(box.querySelectorAll("button[data-up]")).forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-up"));
      if (!Number.isFinite(i) || i <= 0) return;
      const tasks2 = loadTasks();
      const tmp = tasks2[i - 1];
      tasks2[i - 1] = tasks2[i];
      tasks2[i] = tmp;
      saveTasks(tasks2);
      renderTaskChips();
      renderMaster();
    });
  });
  Array.from(box.querySelectorAll("button[data-down]")).forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-down"));
      const tasks2 = loadTasks();
      if (!Number.isFinite(i) || i >= tasks2.length - 1) return;
      const tmp = tasks2[i + 1];
      tasks2[i + 1] = tasks2[i];
      tasks2[i] = tmp;
      saveTasks(tasks2);
      renderTaskChips();
      renderMaster();
    });
  });

  // edit
  Array.from(box.querySelectorAll("button[data-edit]")).forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-edit"));
      if (!Number.isFinite(i)) return;
      const tasks2 = loadTasks();
      const t = tasks2[i];
      if (!t) return;

      const name = prompt("項目名", t.name);
      if (name === null) return;
      const nm = String(name).trim();
      if (nm.length === 0) return;

      const cat = prompt("区分 掃除 洗濯 その他", t.cat);
      if (cat === null) return;
      const ct = CATS.includes(String(cat).trim()) ? String(cat).trim() : "その他";

      const freq = prompt("推奨頻度 日数 例 7 空欄で未設定", (t.freqDays && t.freqDays > 0) ? String(t.freqDays) : "");
      if (freq === null) return;
      const fd = normalizeIntOrNull(String(freq).trim());
      const freqDays = (fd && fd > 0) ? fd : null;

      // name unique check
      const exists = tasks2.find((x, idx) => idx !== i && x.name === nm);
      if (exists) {
        alert("同名が既に存在");
        return;
      }

      tasks2[i] = { ...t, name: nm, cat: ct, freqDays };
      saveTasks(tasks2);
      renderTaskChips();
      renderMaster();
      renderReco();
    });
  });

  // color change
  Array.from(box.querySelectorAll("input[data-bg]")).forEach(inp => {
    inp.addEventListener("input", () => {
      const i = Number(inp.getAttribute("data-bg"));
      const tasks2 = loadTasks();
      if (!tasks2[i]) return;
      tasks2[i].bg = clampColor(inp.value, "#0f0f0f");
      saveTasks(tasks2);
      renderTaskChips();
      renderHistory();
      renderReco();
    });
  });
  Array.from(box.querySelectorAll("input[data-text]")).forEach(inp => {
    inp.addEventListener("input", () => {
      const i = Number(inp.getAttribute("data-text"));
      const tasks2 = loadTasks();
      if (!tasks2[i]) return;
      tasks2[i].text = clampColor(inp.value, "#f0f0f0");
      saveTasks(tasks2);
      renderTaskChips();
      renderHistory();
      renderReco();
    });
  });
}

function addTaskFromInputs() {
  const name = String($("newTask").value ?? "").trim();
  if (name.length === 0) return;

  const cat = String($("newCat").value ?? "").trim();
  const ct = CATS.includes(cat) ? cat : "その他";

  const freqRaw = $("newFreq").value;
  const fd = normalizeIntOrNull(freqRaw);
  const freqDays = (fd && fd > 0) ? fd : null;

  const bg = clampColor($("newBg").value, "#0f0f0f");
  const text = clampColor($("newText").value, "#f0f0f0");

  const tasks = loadTasks();
  const exists = tasks.find(t => t.name === name);
  if (exists) {
    alert("同名が既に存在");
    return;
  }

  tasks.push({ name, cat: ct, freqDays, bg, text });
  saveTasks(tasks);

  $("newTask").value = "";
  $("newFreq").value = "";
  $("newBg").value = "#0f0f0f";
  $("newText").value = "#f0f0f0";

  renderTaskChips();
  renderMaster();
  renderReco();
}

/* recommendation */
function lastDoneMap(rows) {
  const map = new Map(); // name -> iso date max
  rows.forEach(r => {
    const iso = String(r.date ?? "");
    if (!iso) return;
    const tasks = Array.isArray(r.tasks) ? r.tasks : [];
    tasks.forEach(name => {
      const prev = map.get(name);
      if (!prev || prev.localeCompare(iso) < 0) map.set(name, iso);
    });
  });
  return map;
}

function renderReco() {
  const tasks = loadTasks();
  const rows = loadRows();
  const map = lastDoneMap(rows);
  const today = todayISO();

  const targets = tasks
    .filter(t => t.freqDays && t.freqDays > 0)
    .map(t => {
      const last = map.get(t.name) || null;
      let elapsed = null;
      if (last) elapsed = daysBetween(last, today);
      const due = (elapsed === null) ? true : (elapsed >= t.freqDays);
      const over = (elapsed === null) ? (t.freqDays) : (elapsed - t.freqDays);
      return { ...t, last, elapsed, due, over };
    });

  const box = $("reco");
  if (targets.length === 0) {
    box.textContent = "推奨頻度が設定された項目のみ表示";
    return;
  }

  // sort: due first, then larger over
  targets.sort((a, b) => {
    const ad = a.due ? 1 : 0;
    const bd = b.due ? 1 : 0;
    if (ad !== bd) return bd - ad;
    const ao = Number(a.over ?? 0);
    const bo = Number(b.over ?? 0);
    return bo - ao;
  });

  const wrap = document.createElement("div");
  targets.forEach(t => {
    const item = document.createElement("div");
    item.className = "recoItem";

    const left = document.createElement("div");
    left.className = "recoName";
    left.textContent = t.name;
    left.style.color = t.text || "#f0f0f0";

    const meta = document.createElement("div");
    meta.className = "recoMeta";

    const lastTxt = t.last ? formatJP(t.last) : "未実施";
    const elapsedTxt = (t.elapsed === null) ? "不明" : `${t.elapsed}日経過`;
    const freqTxt = `${t.freqDays}日`;
    const dueTxt = t.due ? "要実施" : "猶予";

    meta.innerHTML = `
      <div>${escapeHtml(dueTxt)}</div>
      <div>${escapeHtml(lastTxt)}</div>
      <div>${escapeHtml(elapsedTxt)} 閾値 ${escapeHtml(freqTxt)}</div>
    `;

    item.style.background = "transparent";
    item.appendChild(left);
    item.appendChild(meta);
    wrap.appendChild(item);
  });

  box.innerHTML = "";
  box.appendChild(wrap);
}

/* export import */
function exportJSON() {
  const payload = {
    version: 3,
    exportedAt: new Date().toISOString(),
    appName: loadAppName(),
    tasks: loadTasks(),
    rows: loadRows()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `maintelog_backup_${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      if (!payload || typeof payload !== "object") throw new Error("bad");

      // appName optional
      if (typeof payload.appName === "string") saveAppName(payload.appName);

      // tasks
      if (Array.isArray(payload.tasks)) {
        const migrated = migrateTasks(payload.tasks);
        if (migrated) saveTasks(migrated);
      }

      // rows
      if (Array.isArray(payload.rows)) {
        saveRows(payload.rows);
      }

      boot();
      alert("復元完了");
    } catch {
      alert("読み込み失敗");
    }
  };
  reader.readAsText(file);
}

/* view */
function setView(which) {
  const inputBtn = $("tabInput");
  const histBtn = $("tabHistory");
  const viewInput = $("viewInput");
  const viewHistory = $("viewHistory");

  const isInput = which === "input";
  viewInput.style.display = isInput ? "" : "none";
  viewHistory.style.display = isInput ? "none" : "";

  inputBtn.classList.toggle("active", isInput);
  histBtn.classList.toggle("active", !isInput);

  if (!isInput) {
    renderReco();
    renderHistory();
  }
}

function boot() {
  ensureDefaultTasks();

  $("date").value = todayISO();

  applyAppName();
  renderStatus();
  renderTaskChips();
  renderMaster();
  renderReco();
  renderHistory();
  setView("input");
}

/* events */
$("tabInput").addEventListener("click", () => setView("input"));
$("tabHistory").addEventListener("click", () => setView("history"));
$("footInput").addEventListener("click", () => setView("input"));
$("footHistory").addEventListener("click", () => setView("history"));
$("goInput").addEventListener("click", () => setView("input"));

$("save").addEventListener("click", () => {
  const date = $("date").value || "";
  const nights = normalizeIntOrNull($("nights").value);
  const tasks = getSelectedTasks();
  const other = $("other").value || "";

  if (!date) {
    alert("日付は必須");
    return;
  }
  if (tasks.length === 0 && String(other).trim().length === 0 && (nights === null)) {
    // 日付のみの空記録は抑止
    return;
  }

  addRow({ date, nights, tasks, other });
  clearInput();
  renderStatus();
});

$("clear").addEventListener("click", () => clearInput());

$("wipe").addEventListener("click", () => {
  const ok = confirm("全データ削除");
  if (!ok) return;
  saveRows([]);
  saveTasks(ensureDefaultTasks());
  localStorage.removeItem(APPNAME_KEY);
  boot();
});

$("addTask").addEventListener("click", () => addTaskFromInputs());
$("newTask").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addTaskFromInputs();
  }
});

$("sortDesc").addEventListener("click", () => { sortMode = "desc"; renderHistory(); });
$("sortAsc").addEventListener("click", () => { sortMode = "asc"; renderHistory(); });

$("export").addEventListener("click", () => exportJSON());
$("import").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  importJSON(file);
  e.target.value = "";
});

$("saveAppName").addEventListener("click", () => {
  saveAppName($("appName").value);
  applyAppName();
  alert("保存完了");
});
$("resetAppName").addEventListener("click", () => {
  localStorage.removeItem(APPNAME_KEY);
  applyAppName();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

boot();
