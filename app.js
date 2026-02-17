/* メンテログ v3
  目的
  ・滞在ログを端末内 localStorage のみで管理
  ・入力と履歴をタブで切替
  ・作業マスターは 区分 色 順序 推奨頻度 を保持
  ・推奨は 最終実施日と推奨日数の比較で算出

  互換
  ・rows は maintelog_rows_v2 を維持
  ・tasks は maintelog_tasks_v2 を維持
  ・tasks が旧形式 文字列配列 の場合は 読み込み時にオブジェクトへ昇格
*/

const BUILD_ID = "2026-02-17_v3fix";

const STORAGE_KEY = "maintelog_rows_v2";
const TASKS_KEY = "maintelog_tasks_v2";
const SETTINGS_KEY = "maintelog_settings_v3";

const DEFAULT_APP_NAME = "メンテログ";

const CATEGORY = {
  CLEAN: "clean",
  LAUNDRY: "laundry",
  OTHER: "other",
};

const CATEGORY_LABEL = {
  [CATEGORY.CLEAN]: "掃除",
  [CATEGORY.LAUNDRY]: "洗濯",
  [CATEGORY.OTHER]: "その他",
};

const defaultTasksLegacy = [
  "拭き掃除",
  "掃除機",
  "風呂",
  "トイレ",
  "洗濯",
  "庭",
];

const DEFAULT_TASK_STYLE = {
  bg: "#0a1424",
  border: "#1d395f",
  text: "#d7e9ff",
};

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

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatJP(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return String(iso);
  return `${y}/${m}/${d}`;
}

function parseISODate(iso) {
  if (!iso) return null;
  const s = String(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((ub - ua) / ms);
}

function normalizeNights(raw) {
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  return n;
}

function genId() {
  return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function loadRows() {
  const rows = loadJSON(STORAGE_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function saveRows(rows) {
  saveJSON(STORAGE_KEY, rows);
}

function loadSettings() {
  const s = loadJSON(SETTINGS_KEY, {});
  if (!s || typeof s !== "object") return { appName: DEFAULT_APP_NAME };
  return {
    appName: String(s.appName || DEFAULT_APP_NAME),
  };
}

function saveSettings(next) {
  const s = {
    appName: String(next?.appName || DEFAULT_APP_NAME),
  };
  saveJSON(SETTINGS_KEY, s);
}

function normalizeTaskObject(obj) {
  const name = String(obj?.name ?? "").trim();
  if (!name) return null;
  const id = String(obj?.id ?? "").trim() || genId();
  const category = [CATEGORY.CLEAN, CATEGORY.LAUNDRY, CATEGORY.OTHER].includes(obj?.category)
    ? obj.category
    : CATEGORY.OTHER;
  const freqDays = obj?.freqDays === "" || obj?.freqDays === null || obj?.freqDays === undefined
    ? null
    : Number(obj.freqDays);
  const freq = Number.isFinite(freqDays) && freqDays > 0 ? Math.floor(freqDays) : null;

  const style = obj?.style && typeof obj.style === "object" ? obj.style : {};
  const bg = String(style.bg || DEFAULT_TASK_STYLE.bg);
  const border = String(style.border || DEFAULT_TASK_STYLE.border);
  const text = String(style.text || DEFAULT_TASK_STYLE.text);

  return { id, name, category, freqDays: freq, style: { bg, border, text } };
}

function loadTasks() {
  const raw = loadJSON(TASKS_KEY, null);

  // 旧形式
  if (!raw) {
    return defaultTasksLegacy.map((t) => ({
      id: genId(),
      name: t,
      category: CATEGORY.OTHER,
      freqDays: null,
      style: { ...DEFAULT_TASK_STYLE },
    }));
  }

  if (Array.isArray(raw)) {
    // 旧形式 文字列配列
    if (raw.every((x) => typeof x === "string")) {
      const base = raw.length ? raw : defaultTasksLegacy;
      const tasks = base.map((t) => ({
        id: genId(),
        name: String(t),
        category: CATEGORY.OTHER,
        freqDays: null,
        style: { ...DEFAULT_TASK_STYLE },
      }));
      // 互換維持しつつ昇格保存
      saveTasks(tasks);
      return tasks;
    }

    // 新形式
    const tasks = raw.map(normalizeTaskObject).filter(Boolean);
    if (tasks.length === 0) return [];
    return tasks;
  }

  return [];
}

function saveTasks(tasks) {
  const cleaned = (tasks || []).map(normalizeTaskObject).filter(Boolean);
  // name 重複は UI で避けたいが ここでは先勝ち
  const seen = new Set();
  const unique = [];
  for (const t of cleaned) {
    if (seen.has(t.name)) continue;
    seen.add(t.name);
    unique.push(t);
  }
  saveJSON(TASKS_KEY, unique);
}

function taskIndexById(tasks) {
  const m = new Map();
  tasks.forEach((t) => m.set(t.id, t));
  return m;
}

function taskIndexByName(tasks) {
  const m = new Map();
  tasks.forEach((t) => m.set(t.name, t));
  return m;
}

function renderStatus() {
  const rows = loadRows();
  $("status").textContent = `記録 ${rows.length}件`;
}

function renderAppName() {
  const s = loadSettings();
  const name = String(s.appName || DEFAULT_APP_NAME).trim() || DEFAULT_APP_NAME;
  $("appTitle").textContent = name;
  document.title = name;
  $("appName").value = name;
}

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
    renderHistory();
    renderRecommend();
  }
}

function clearInput() {
  $("date").value = todayISO();
  $("nights").value = "";
  $("other").value = "";
  // チェック解除
  const wrap = $("tasks");
  Array.from(wrap.querySelectorAll('input[type="checkbox"]')).forEach((c) => (c.checked = false));
}

function addRow(row) {
  const rows = loadRows();
  const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  rows.push({ id, ...row });
  saveRows(rows);
  return id;
}

function deleteRow(id) {
  const rows = loadRows();
  saveRows(rows.filter((r) => r.id !== id));
}

function rowTasks(r) {
  const tasks = Array.isArray(r?.tasks) ? r.tasks : [];
  return tasks.map(String).filter((x) => x.trim().length > 0);
}

function rowOther(r) {
  return String(r?.other ?? "").trim();
}

function buildPillHtml(label, taskMeta) {
  const safe = escapeHtml(label);
  if (!taskMeta) return `<span class="pill">${safe}</span>`;
  const bg = escapeHtml(taskMeta.style?.bg || DEFAULT_TASK_STYLE.bg);
  const border = escapeHtml(taskMeta.style?.border || DEFAULT_TASK_STYLE.border);
  const text = escapeHtml(taskMeta.style?.text || DEFAULT_TASK_STYLE.text);
  return `<span class="pill" style="background:${bg};border-color:${border};color:${text}">${safe}</span>`;
}

function renderTaskChips() {
  const tasks = loadTasks();
  const wrap = $("tasks");
  wrap.innerHTML = "";

  const groups = [CATEGORY.CLEAN, CATEGORY.LAUNDRY, CATEGORY.OTHER]
    .map((cat) => ({
      cat,
      label: CATEGORY_LABEL[cat],
      list: tasks.filter((t) => t.category === cat),
    }))
    .filter((g) => g.list.length > 0);

  if (groups.length === 0) {
    wrap.innerHTML = `<div class="muted">選択肢なし</div>`;
    return;
  }

  groups.forEach((g) => {
    const head = document.createElement("div");
    head.className = "grouphead";
    head.textContent = g.label;
    wrap.appendChild(head);

    const row = document.createElement("div");
    row.className = "chips";

    g.list.forEach((t) => {
      const label = document.createElement("label");
      label.className = "chip";
      const bg = t.style?.bg || DEFAULT_TASK_STYLE.bg;
      const border = t.style?.border || DEFAULT_TASK_STYLE.border;
      const text = t.style?.text || DEFAULT_TASK_STYLE.text;
      label.style.background = bg;
      label.style.borderColor = border;
      label.style.color = text;
      label.innerHTML = `<input type="checkbox" value="${escapeHtml(t.name)}" /> <span class="chiptext">${escapeHtml(t.name)}</span>`;
      row.appendChild(label);
    });

    wrap.appendChild(row);
  });
}

function getSelectedTaskNames() {
  const wrap = $("tasks");
  const checks = Array.from(wrap.querySelectorAll('input[type="checkbox"]'));
  return checks.filter((c) => c.checked).map((c) => c.value);
}

function renderHistory() {
  const tasks = loadTasks();
  const byName = taskIndexByName(tasks);

  const rows = loadRows().slice();
  rows.sort((a, b) => {
    const ad = String(a?.date ?? "");
    const bd = String(b?.date ?? "");
    if (sortMode === "asc") return ad.localeCompare(bd);
    return bd.localeCompare(ad);
  });

  const body = $("historyBody");
  body.innerHTML = "";

  if (rows.length === 0) {
    body.innerHTML = `<tr><td colspan="4" class="muted">記録なし</td></tr>`;
    return;
  }

  rows.forEach((r) => {
    const dateTxt = r.date ? formatJP(r.date) : "日付不明";
    const nightsTxt = r.nights === 0 || r.nights ? String(r.nights) : "";

    const parts = [];
    rowTasks(r).forEach((t) => parts.push({ label: t, meta: byName.get(t) || null }));
    const other = rowOther(r);
    if (other) parts.push({ label: other, meta: null });

    const pills = parts
      .map((p) => buildPillHtml(p.label, p.meta))
      .join("");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(dateTxt)}</td>
      <td>${escapeHtml(nightsTxt)}</td>
      <td>${pills || `<span class="muted">空</span>`}</td>
      <td class="right"><button data-del="${escapeHtml(r.id)}" type="button">削除</button></td>
    `;
    body.appendChild(tr);
  });

  Array.from(body.querySelectorAll("button[data-del]"))
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del");
        if (!id) return;
        const ok = confirm("この行を削除");
        if (!ok) return;
        deleteRow(id);
        renderStatus();
        renderHistory();
        renderRecommend();
      });
    });
}

function lastDoneDateForTask(taskName, rows) {
  let last = null;
  rows.forEach((r) => {
    const dt = parseISODate(r?.date);
    if (!dt) return;
    const tasks = rowTasks(r);
    if (!tasks.includes(taskName)) return;
    if (!last || dt.getTime() > last.getTime()) last = dt;
  });
  return last;
}

function renderRecommend() {
  const box = $("recommend");
  const tasks = loadTasks().filter((t) => Number.isFinite(t.freqDays) && t.freqDays > 0);
  const rows = loadRows();

  if (tasks.length === 0) {
    box.innerHTML = `<div class="muted">次回推奨作業は マスターで 推奨頻度 日数 を設定すると表示</div>`;
    return;
  }

  const today = parseISODate(todayISO()) || new Date();

  const items = tasks.map((t) => {
    const last = lastDoneDateForTask(t.name, rows);
    const elapsed = last ? daysBetween(last, today) : null;
    const due = elapsed === null ? true : elapsed >= t.freqDays;
    const ratio = elapsed === null ? 999999 : elapsed / t.freqDays;
    return { task: t, last, elapsed, due, ratio };
  });

  items.sort((a, b) => b.ratio - a.ratio);

  const top = items.slice(0, 8);

  const lines = top.map((it) => {
    const t = it.task;
    const label = escapeHtml(t.name);
    const pill = buildPillHtml(t.name, t);

    const lastTxt = it.last ? formatJP(`${it.last.getFullYear()}-${String(it.last.getMonth() + 1).padStart(2, "0")}-${String(it.last.getDate()).padStart(2, "0")}`) : "未実施";
    const elapsedTxt = it.elapsed === null ? "-" : String(it.elapsed);
    const dueTxt = it.due ? "要実施" : "未到達";

    return `
      <div class="recrow">
        <div class="recleft">${pill}</div>
        <div class="recright small">最終 ${escapeHtml(lastTxt)} 経過 ${escapeHtml(elapsedTxt)}日 閾値 ${escapeHtml(String(t.freqDays))}日 ${escapeHtml(dueTxt)}</div>
      </div>
    `;
  }).join("");

  box.innerHTML = `
    <div class="small muted" style="margin-bottom:6px">次回推奨作業 最終実施日と推奨日数の比較</div>
    <div>${lines}</div>
  `;
}

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
    div.className = "masteritem";

    const pill = document.createElement("div");
    pill.innerHTML = buildPillHtml(t.name, t);

    const catSel = document.createElement("select");
    catSel.innerHTML = `
      <option value="${CATEGORY.CLEAN}">${CATEGORY_LABEL[CATEGORY.CLEAN]}</option>
      <option value="${CATEGORY.LAUNDRY}">${CATEGORY_LABEL[CATEGORY.LAUNDRY]}</option>
      <option value="${CATEGORY.OTHER}">${CATEGORY_LABEL[CATEGORY.OTHER]}</option>
    `;
    catSel.value = t.category;

    const freq = document.createElement("input");
    freq.type = "number";
    freq.min = "1";
    freq.inputMode = "numeric";
    freq.placeholder = "推奨 日数";
    freq.value = t.freqDays ? String(t.freqDays) : "";

    const bg = document.createElement("input");
    bg.type = "color";
    bg.value = t.style?.bg || DEFAULT_TASK_STYLE.bg;

    const border = document.createElement("input");
    border.type = "color";
    border.value = t.style?.border || DEFAULT_TASK_STYLE.border;

    const text = document.createElement("input");
    text.type = "color";
    text.value = t.style?.text || DEFAULT_TASK_STYLE.text;

    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "上へ";
    up.disabled = idx === 0;

    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "下へ";
    down.disabled = idx === tasks.length - 1;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger";
    del.textContent = "削除";

    const col = document.createElement("div");
    col.className = "mastercol";
    col.innerHTML = `
      <div class="mastername">${escapeHtml(t.name)}</div>
      <div class="mastergrid">
        <div>
          <label>区分</label>
          <div class="slot" data-slot="cat"></div>
        </div>
        <div>
          <label>推奨 日数</label>
          <div class="slot" data-slot="freq"></div>
        </div>
        <div>
          <label>背景</label>
          <div class="slot" data-slot="bg"></div>
        </div>
        <div>
          <label>枠</label>
          <div class="slot" data-slot="border"></div>
        </div>
        <div>
          <label>文字</label>
          <div class="slot" data-slot="text"></div>
        </div>
      </div>
      <div class="masteractions">
        <div class="slot" data-slot="up"></div>
        <div class="slot" data-slot="down"></div>
        <div class="slot" data-slot="del"></div>
      </div>
    `;

    col.querySelector('[data-slot="cat"]').appendChild(catSel);
    col.querySelector('[data-slot="freq"]').appendChild(freq);
    col.querySelector('[data-slot="bg"]').appendChild(bg);
    col.querySelector('[data-slot="border"]').appendChild(border);
    col.querySelector('[data-slot="text"]').appendChild(text);
    col.querySelector('[data-slot="up"]').appendChild(up);
    col.querySelector('[data-slot="down"]').appendChild(down);
    col.querySelector('[data-slot="del"]').appendChild(del);

    div.appendChild(pill);
    div.appendChild(col);
    box.appendChild(div);

    function commit(partial) {
      const next = loadTasks();
      const pos = next.findIndex((x) => x.id === t.id);
      if (pos < 0) return;
      next[pos] = normalizeTaskObject({ ...next[pos], ...partial });
      saveTasks(next);
    }

    catSel.addEventListener("change", () => {
      commit({ category: catSel.value });
      renderTaskChips();
      renderMaster();
    });

    freq.addEventListener("change", () => {
      commit({ freqDays: normalizeNights(freq.value) });
      renderRecommend();
    });

    function commitStyle() {
      commit({ style: { bg: bg.value, border: border.value, text: text.value } });
      renderTaskChips();
      renderHistory();
      renderRecommend();
    }

    bg.addEventListener("change", commitStyle);
    border.addEventListener("change", commitStyle);
    text.addEventListener("change", commitStyle);

    up.addEventListener("click", () => {
      const next = loadTasks();
      const i = next.findIndex((x) => x.id === t.id);
      if (i <= 0) return;
      const tmp = next[i - 1];
      next[i - 1] = next[i];
      next[i] = tmp;
      saveTasks(next);
      renderTaskChips();
      renderMaster();
    });

    down.addEventListener("click", () => {
      const next = loadTasks();
      const i = next.findIndex((x) => x.id === t.id);
      if (i < 0 || i >= next.length - 1) return;
      const tmp = next[i + 1];
      next[i + 1] = next[i];
      next[i] = tmp;
      saveTasks(next);
      renderTaskChips();
      renderMaster();
    });

    del.addEventListener("click", () => {
      const ok = confirm("選択肢を削除");
      if (!ok) return;
      const next = loadTasks().filter((x) => x.id !== t.id);
      saveTasks(next);
      renderTaskChips();
      renderMaster();
      renderRecommend();
    });
  });
}

function addTaskFromInput() {
  const name = String($("newTask").value ?? "").trim();
  if (!name) return;

  const existing = loadTasks();
  if (existing.some((t) => t.name === name)) {
    alert("同名が既に存在");
    return;
  }

  const t = {
    id: genId(),
    name,
    category: CATEGORY.OTHER,
    freqDays: null,
    style: { ...DEFAULT_TASK_STYLE },
  };

  existing.push(t);
  saveTasks(existing);
  $("newTask").value = "";
  renderTaskChips();
  renderMaster();
}

function exportJSON() {
  const payload = {
    version: 3,
    buildId: BUILD_ID,
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
    tasks: loadTasks(),
    rows: loadRows(),
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

      if (payload.settings && typeof payload.settings === "object") saveSettings(payload.settings);
      if (Array.isArray(payload.tasks)) saveTasks(payload.tasks);
      if (Array.isArray(payload.rows)) saveRows(payload.rows);

      boot();
      alert("復元完了");
    } catch {
      alert("読み込み失敗");
    }
  };
  reader.readAsText(file);
}

function toastShow(text) {
  $("toastText").textContent = text;
  $("toast").classList.add("show");
}

function toastHide() {
  $("toast").classList.remove("show");
}

let sortMode = "desc";

function boot() {
  $("date").value = todayISO();
  renderAppName();
  renderStatus();
  renderTaskChips();
  renderMaster();
  renderHistory();
  renderRecommend();
  setView("input");
}

// タブ
$("tabInput").addEventListener("click", () => setView("input"));
$("tabHistory").addEventListener("click", () => setView("history"));
$("footInput").addEventListener("click", () => setView("input"));
$("footHistory").addEventListener("click", () => setView("history"));
$("goInput").addEventListener("click", () => setView("input"));

// 入力
$("save").addEventListener("click", () => {
  const date = $("date").value || "";
  const nights = normalizeNights($("nights").value);
  const tasks = getSelectedTaskNames();
  const other = $("other").value || "";

  if (!date && tasks.length === 0 && String(other).trim().length === 0) return;

  addRow({ date, nights, tasks, other });
  clearInput();
  renderStatus();
});

$("clear").addEventListener("click", () => clearInput());

$("wipe").addEventListener("click", () => {
  const ok = confirm("全データ削除");
  if (!ok) return;
  saveRows([]);
  clearInput();
  renderStatus();
  renderHistory();
  renderRecommend();
});

// マスター
$("addTask").addEventListener("click", () => addTaskFromInput());
$("newTask").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addTaskFromInput();
  }
});

// 設定
$("saveAppName").addEventListener("click", () => {
  const v = String($("appName").value ?? "").trim();
  saveSettings({ appName: v || DEFAULT_APP_NAME });
  renderAppName();
});

// 履歴
$("sortDesc").addEventListener("click", () => { sortMode = "desc"; renderHistory(); });
$("sortAsc").addEventListener("click", () => { sortMode = "asc"; renderHistory(); });

// JSON
$("export").addEventListener("click", () => exportJSON());
$("import").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  importJSON(file);
  e.target.value = "";
});

// Toast
$("toastClose").addEventListener("click", () => toastHide());
$("toastReload").addEventListener("click", () => {
  toastHide();
  location.reload();
});

// SW
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js");

      // 更新検知
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            toastShow("新しい版を検出 更新で反映");
          }
        });
      });

      // コントローラ交代
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        toastShow("更新完了 再読み込み推奨");
      });
    } catch {
      // 失敗時は黙る
    }
  });
}

boot();
