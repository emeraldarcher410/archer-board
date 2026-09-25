/* Archer Analytics — phone board (ADR-0032, ADR-0033). No build step, no dependencies. */
(function () {
  "use strict";
  // ------------------------------------------------------------------ utilities
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (p, d = 0) => (p == null || isNaN(p) ? "—" : (p * 100).toFixed(d) + "%");
  const fmt1 = (v) => (v == null ? "—" : Number(v).toFixed(1));
  const odds = (x) => (x == null || isNaN(x) ? "—" : (x > 0 ? "+" : "") + Math.round(x));
  const dec = (a) => (a > 0 ? 1 + a / 100 : 1 + 100 / Math.abs(a));
  const toAmerican = (d) => (d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)));
  const implied = (a) => (a > 0 ? 100 / (a + 100) : Math.abs(a) / (Math.abs(a) + 100));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* private mode */ } },
  };
  const buzz = () => { try { navigator.vibrate && navigator.vibrate(12); } catch (_) { /* no haptics */ } };
  const normName = (n) => String(n || "").toLowerCase().replace(/\./g, " ").replace(/[^a-z ]/g, "").split(/\s+/).filter((t) => t && !["jr", "sr", "ii", "iii", "iv"].includes(t)).join(" ");
  const leagueOf = (r) => (String(r.sport || "").endsWith("ncaaf") ? "cfb" : "nfl");
  const parseStamp = (s) => { if (!s) return null; const m = String(s).match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/); return m ? new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`) : new Date(s); };
  const ageText = (d) => { if (!d || isNaN(d)) return null; const m = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000)); return m < 1 ? "just now" : m < 60 ? `${m} min` : m < 1440 ? `${(m / 60).toFixed(1)} h` : `${(m / 1440).toFixed(1)} d`; };
  const STAT_OF = { player_pass_yds: "pass_yds", player_pass_tds: "pass_td", player_pass_completions: "pass_cmp", player_pass_attempts: "pass_att", player_pass_interceptions: "int", player_rush_yds: "rush_yds", player_rush_attempts: "rush_att", player_receptions: "rec", player_reception_yds: "rec_yds" };
  const LABEL = { player_reception_yds: "Rec yds", player_receptions: "Receptions", player_pass_yds: "Pass yds", player_pass_tds: "Pass TDs", player_pass_completions: "Completions", player_pass_attempts: "Pass att", player_pass_interceptions: "INTs", player_rush_yds: "Rush yds", player_rush_attempts: "Carries", player_anytime_td: "Anytime TD" };
  const APP = { prizepicks: "PrizePicks", underdog: "Underdog", fanduel: "FanDuel", draftkings: "DraftKings", espnbet: "ESPN Bet" };
  const DOT = { prizepicks: "#8B5CF6", underdog: "#FACC15", hardrockbet_fl: "#D4AF37", hardrockbet: "#D4AF37", fanduel: "#1493FF", draftkings: "#53D337", espnbet: "#E11D48" };
  const bookName = (b) => APP[b] || (String(b).startsWith("hardrock") ? "Hard Rock" : b);
  const rowKey = (r) => [r.book || "hardrockbet_fl", r.event_id, r.market, r.player_ref, r.side].join("|");
  const initials = (n) => String(n || "").split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  function when(iso) {
    if (!iso) return { txt: "", cls: "" };
    const d = new Date(iso); if (isNaN(d)) return { txt: "", cls: "" };
    const m = (d - Date.now()) / 60000;
    if (m <= 0) return { txt: m > -240 ? "Live · locked" : "Final", cls: "live", locked: true };
    if (m < 60) return { txt: `in ${Math.round(m)}m`, cls: "soon" };
    if (m < 12 * 60) return { txt: `in ${Math.floor(m / 60)}h ${Math.round(m % 60)}m`, cls: "" };
    return { txt: d.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }), cls: "" };
  }

  // ------------------------------------------------------------------ state
  const state = {
    tab: "props", league: store.get("archer-league", "nfl"), q: "", rows: [], meta: {}, games: {}, results: null, history: null, assets: null,
    f: Object.assign({ agree: 1, book: "all", market: "all", sort: "edge", watch: false, started: false }, store.get("archer-filters", {})),
    day: "all", betFilter: "open", recFilter: "fav",
    slip: store.get("archer-slip-v1", []), bets: store.get("archer-bets-v1", []),
    watch: new Set(store.get("archer-watch", [])), hidden: new Set(), asOf: null,
  };
  const saveF = () => store.set("archer-filters", state.f);

  function toast(msg, action) {
    $$(".toast").forEach((t) => t.remove());
    const t = document.createElement("div"); t.className = "toast";
    t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ""}`;
    if (action) t.querySelector("button").addEventListener("click", () => { action.fn(); t.remove(); });
    document.body.appendChild(t); setTimeout(() => t.remove(), action ? 4000 : 2000);
  }

  // ------------------------------------------------------------------ brand assets
  function team(league, id) {
    const a = state.assets && state.assets[league];
    if (!a || !id) return null;
    return a.teams[id] || a.teams[a.alias[id]] || null;
  }
  const teamId = (league, name) => { const a = state.assets && state.assets[league]; return (a && a.alias[name]) || name; };
  // NFL faces: by name + team first (two players can share a name), then by name. Each entry
  // is [NFL.com headshot, ESPN headshot]; a failed image falls back to the next, then to initials.
  const faceKey = (n) => normName(n).replace(/ /g, "");
  function face(league, name, tid) {
    const a = state.assets; if (league !== "nfl" || !a) return null;
    const k = faceKey(name), got = (a.players_team && tid && a.players_team[`${k}|${tid}`]) || (a.players && a.players[k]);
    return Array.isArray(got) ? got : got ? [got] : null;
  }
  const faceImg = (urls, cls) => (urls && urls.length ? `<img class="${cls}" src="${esc(urls[0])}" data-alt="${esc(urls[1] || "")}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt=''}else{this.remove()}">` : "");
  function avatar(name, league, tid, size) {
    const t = team(league, tid), f = face(league, name, tid), col = (t && t.color) || "#334155";
    return `<div class="av ${size || ""}" style="--tc:${esc(col)}"><span class="ini">${esc(initials(name))}</span>${faceImg(f, "face")}${t && t.logo ? `<span class="badge"><img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.parentNode.remove()"></span>` : ""}</div>`;
  }
  const logoImg = (league, id, cls) => { const t = team(league, id); return t && t.logo ? `<img class="${cls || ""}" src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.remove()">` : ""; };
  function logoBox(league, id) {
    const t = team(league, id), ab = esc(((t && t.abbr) || id || "").slice(0, 4));
    return t && t.logo ? `<img class="lg" src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;fb&quot; style=&quot;--tc:${esc((t && t.color) || "#334155")}&quot;>${ab}</span>'">`
      : `<span class="fb" style="--tc:${esc((t && t.color) || "#334155")}">${ab}</span>`;
  }
  const abbr = (league, id) => { const t = team(league, id); return (t && t.abbr) || id || ""; };

  // ------------------------------------------------------------------ prop pieces
  function meter(label, p, be, kind) {
    if (p == null) return "";
    const yes = p >= be;
    return `<div class="m"><span class="lb">${label}</span><div class="bar" aria-hidden="true"><i class="${kind === "pff" ? "pff" : yes ? "y" : ""}" style="width:${Math.min(100, p * 100)}%"></i><u style="left:${be * 100}%"></u></div><span class="v">${pct(p)}</span><span class="ok ${yes ? "y" : ""}">${yes ? "✓" : "·"}</span></div>`;
  }
  const meters = (r, be) => `<div class="meters">${meter("Fair", r.p_book, be)}${meter("Form", r.p_naive, be)}${meter("Matchup", r.p_matchup, be)}${meter("PFF", r.p_pff, be, "pff")}</div>`;
  function movement(r) {
    if (r.open_line != null && r.line != null && Number(r.open_line) !== Number(r.line)) {
      const up = Number(r.line) > Number(r.open_line);
      const good = (r.side === "over") !== up; // a lower line is better for an over
      return `<span class="mv ${good ? "up" : "dn"}">${up ? "▲" : "▼"} was ${r.open_line}</span>`;
    }
    if (!r.dfs && r.open_price != null && r.price != null && Math.round(r.open_price) !== Math.round(r.price)) {
      return `<span class="mv ${r.price > r.open_price ? "up" : "dn"}">price was ${odds(r.open_price)}</span>`;
    }
    return "";
  }
  function bookPill(r, be) {
    return r.dfs
      ? `<span class="book"><span class="sw" style="background:${DOT[r.book] || "#94A3B8"}"></span>${esc(bookName(r.book))} · needs <b>${pct(be)}</b></span>`
      : `<span class="book"><span class="sw" style="background:${DOT[r.book] || "#D4AF37"}"></span>Hard Rock <b>${odds(r.price)}</b></span>`;
  }
  function verdictChip(r) {
    if (r.fav) return `<span class="verdict fav">★ Favorite</span>`;
    const c = r.verdict === "Strong lean" ? "strong" : r.verdict === "Lean" ? "lean" : r.verdict === "Split" ? "split" : r.verdict === "Out" ? "out" : "";
    return r.verdict ? `<span class="verdict ${c}">${esc(r.verdict)}</span>` : "";
  }
  function ctxLine(r) {
    const lg = leagueOf(r), w = when(r.commence_time);
    const opp = r.opponent ? `${logoImg(lg, r.opponent)}vs ${esc(abbr(lg, r.opponent))}` : esc(`${r.away_team || ""} @ ${r.home_team || ""}`);
    return `${opp}${w.txt ? ` · <span class="when ${w.cls}">${esc(w.txt)}</span>` : ""}`;
  }
  const inSlip = (r) => state.slip.some((l) => l.id === propLeg(r).id);

  function card(r, i) {
    const lg = leagueOf(r), be = r.breakeven_p ?? 0.524, t = team(lg, r.form_team), over = r.side === "over";
    const w = when(r.commence_time);
    const tags = [
      movement(r),
      r.dfs && r.best_line === false ? '<span class="tag warn">better line on another app</span>' : "",
      r.dfs && r.best_line === true && r.other_lines ? '<span class="tag good">best line</span>' : "",
      r.n_games != null && r.n_games < 5 ? `<span class="tag">thin form · ${r.n_games} g</span>` : "",
    ].join("");
    return `<div class="swipe" data-i="${i}"><div class="under"><span class="l">+ Slip</span><span class="r">Hide</span></div>
      <div class="card ${w.locked ? "locked" : ""}" style="--tc:${esc((t && t.color) || "var(--line-2)")}">
        <div class="ph">${avatar(r.player_ref, lg, r.form_team)}
          <div class="who"><div class="nm">${state.watch.has(normName(r.player_ref)) ? '<span class="star">★</span>' : ""}${esc(r.player_ref)}${r.status === "OUT" ? '<span class="st out">OUT</span>' : r.status === "Q" ? '<span class="st q">Q</span>' : ""}</div>
            <div class="ctx">${ctxLine(r)}</div></div>
          <div class="signal">${verdictChip(r)}<button class="quick ${inSlip(r) ? "on" : ""}" data-quick="${i}" aria-label="Add to slip">${inSlip(r) ? "✓" : "+"}</button></div>
        </div>
        <div class="pickrow"><span class="mkt">${esc(r.market_label || LABEL[r.market] || r.market)}</span>
          <span class="line"><span class="dir ${over ? "o" : "u"}">${over ? "OVER" : "UNDER"}</span><span class="num">${r.line}</span></span></div>
        <div class="subrow">${bookPill(r, be)}${tags}</div>
        ${meters(r, be)}
        ${r.why ? `<div class="why">${esc(r.why)}</div>` : ""}
      </div></div>`;
  }

  function propLeg(r) {
    return {
      id: `p|${r.book || "hardrockbet_fl"}|${r.event_id}|${r.player_ref}|${r.market}|${r.side}|${r.line}`, kind: "prop", league: leagueOf(r),
      label: `${r.player_ref} ${r.market_label || LABEL[r.market] || r.market} ${r.side} ${r.line}`, sub: `${r.away_team || ""} @ ${r.home_team || ""}`,
      name_key: normName(r.player_ref), stat: STAT_OF[r.market] || null, side: r.side, line: r.line, market: r.market, book: r.book,
      price: r.dfs ? null : r.price, p: r.p_model ?? null, event: r.event_id, date: String(r.commence_time || "").slice(0, 10), kick: r.commence_time,
      dfs: !!r.dfs, app: r.dfs ? APP[r.book] || r.book : null, be: r.breakeven_p ?? null, team: r.form_team,
    };
  }

  // ------------------------------------------------------------------ props list
  let shown = [];
  function leagueRows() { return state.rows.filter((r) => leagueOf(r) === state.league); }
  function filtered() {
    const f = state.f, q = state.q.trim().toLowerCase();
    let rows = leagueRows().filter((r) => (r.agree_count ?? 0) >= f.agree && !state.hidden.has(rowKey(r)));
    if (!f.started) rows = rows.filter((r) => !when(r.commence_time).locked);
    if (f.market !== "all") rows = rows.filter((r) => r.market === f.market);
    if (f.book !== "all") rows = rows.filter((r) => (r.book || "hardrockbet_fl") === f.book);
    if (f.watch) rows = rows.filter((r) => state.watch.has(normName(r.player_ref)));
    if (q) rows = rows.filter((r) => [r.player_ref, r.home_team, r.away_team, r.opponent, r.form_team].some((v) => String(v ?? "").toLowerCase().includes(q)));
    const w = (r) => (state.watch.has(normName(r.player_ref)) ? 1 : 0);
    const by = {
      edge: (x, y) => w(y) - w(x) || (y.fav ? 1 : 0) - (x.fav ? 1 : 0) || (y.agree_count ?? 0) - (x.agree_count ?? 0) || (y.edge ?? -9) - (x.edge ?? -9),
      kick: (x, y) => String(x.commence_time || "").localeCompare(String(y.commence_time || "")) || (y.edge ?? -9) - (x.edge ?? -9),
      name: (x, y) => String(x.player_ref).localeCompare(String(y.player_ref)),
    };
    return rows.sort(by[f.sort] || by.edge);
  }
  function renderTops() {
    const favs = leagueRows().filter((r) => r.fav && !when(r.commence_time).locked).sort((x, y) => (y.edge ?? 0) - (x.edge ?? 0)).slice(0, 8);
    $("#tops").innerHTML = favs.length ? favs.map((r, k) => {
      const lg = leagueOf(r), t = team(lg, r.form_team), be = r.breakeven_p ?? 0.524;
      return `<div class="top" data-top="${k}" style="--tc:${esc((t && t.color) || "#334155")}"><span class="rk">${k + 1}</span>
        <div class="who2">${avatar(r.player_ref, lg, r.form_team, "sm")}<div class="who"><div class="nm">${esc(r.player_ref)}</div><div class="ctx">${ctxLine(r)}</div></div></div>
        <div class="p"><span class="big">${r.side === "over" ? "O" : "U"} ${r.line} <small class="mk3">${esc(LABEL[r.market] || r.market)}</small></span><span class="prob">${pct(r.p_model)}</span></div>
        <div class="foot2">${esc(bookName(r.book))} ${r.dfs ? "· needs " + pct(be) : odds(r.price) + " · needs " + pct(be)}</div></div>`;
    }).join("") : `<div class="top empty2">No favorites right now. The rule is strict by design: both projections must clear by 3+ points with no injury tag. Browse the full board below.</div>`;
    state.topRows = favs;
  }
  function renderProps() {
    renderTops();
    const rows = filtered();
    shown = rows.slice(0, 200);
    const total = leagueRows().length;
    $("#count").textContent = `${rows.length} of ${total}`;
    $("#count2").textContent = rows.length > 200 ? "Showing the top 200" : "";
    const nh = [...state.hidden].length;
    $("#unhide").textContent = `${nh} hidden · show`; $("#unhide").classList.toggle("hidden", !nh);
    $("#list").innerHTML = shown.length ? shown.map(card).join("")
      : `<div class="empty"><b>${total ? "Nothing matches" : "No props yet"}</b>${total ? "Loosen the filters, or check back after the next board." : "The next board publishes after the next line snapshot."}</div>`;
    renderApplied();
  }
  function renderApplied() {
    const f = state.f, out = [];
    if (f.agree !== 1) out.push(["agree", f.agree === 2 ? "Both clear" : "Everything"]);
    if (f.book !== "all") out.push(["book", bookName(f.book)]);
    if (f.market !== "all") out.push(["market", LABEL[f.market] || f.market]);
    if (f.watch) out.push(["watch", "★ Watchlist"]);
    if (f.started) out.push(["started", "Incl. started"]);
    if (f.sort !== "edge") out.push(["sort", f.sort === "kick" ? "Sort: kickoff" : "Sort: A–Z"]);
    $("#applied").innerHTML = out.map(([k, t]) => `<button class="chip" aria-pressed="true" data-clear="${k}">${esc(t)} ✕</button>`).join("");
    $("#filterN").textContent = out.length; $("#filterN").classList.toggle("hidden", !out.length);
  }
  $("#applied").addEventListener("click", (e) => {
    const b = e.target.closest("[data-clear]"); if (!b) return;
    const d = { agree: 1, book: "all", market: "all", watch: false, started: false, sort: "edge" };
    state.f[b.dataset.clear] = d[b.dataset.clear]; saveF(); renderProps();
  });
  $("#unhide").addEventListener("click", () => { state.hidden.clear(); store.set("archer-hidden", { asOf: state.asOf, keys: [] }); renderProps(); });
  $("#q").addEventListener("input", (e) => { state.q = e.target.value; renderProps(); });
  $("#tops").addEventListener("click", (e) => { const c = e.target.closest("[data-top]"); if (c) openPlayer(state.topRows[Number(c.dataset.top)]); });

  // filter sheet
  $("#filterBtn").addEventListener("click", () => {
    const rows = leagueRows(), f = state.f;
    const books = [...new Set(rows.map((r) => r.book || "hardrockbet_fl"))], markets = [...new Set(rows.map((r) => r.market))];
    const grp = (title, key, items) => `<div class="fgrp"><h4>${title}</h4><div class="chips">${items.map(([v, t, dot]) => `<button class="chip" data-k="${key}" data-v="${esc(String(v))}" aria-pressed="${String(f[key]) === String(v)}">${dot ? `<span class="sw" style="background:${dot}"></span>` : ""}${esc(t)}</button>`).join("")}</div></div>`;
    const s = openSheet(`<div class="sh-top"><h2>Filter &amp; sort</h2><button class="btn small" data-close>Done</button></div>
      ${grp("Signal", "agree", [[2, "Both clear"], [1, "Either clears"], [0, "Everything"]])}
      ${grp("App", "book", [["all", "All apps"]].concat(books.map((b) => [b, bookName(b), DOT[b]])))}
      ${grp("Market", "market", [["all", "All markets"]].concat(markets.map((m) => [m, LABEL[m] || m])))}
      ${grp("Sort", "sort", [["edge", "Best edge"], ["kick", "Kickoff"], ["name", "Player A–Z"]])}
      ${grp("Show", "watch", [[false, "All players"], [true, "★ Watchlist only"]])}
      ${grp("Started games", "started", [[false, "Hide"], [true, "Show (locked)"]])}
      <div class="actions"><button class="btn grow" data-reset>Reset</button><button class="btn primary grow" data-close>Show ${filtered().length} props</button></div>`);
    s.addEventListener("click", (e) => {
      const c = e.target.closest("[data-k]");
      if (c) {
        const k = c.dataset.k, raw = c.dataset.v;
        state.f[k] = k === "agree" ? Number(raw) : raw === "true" ? true : raw === "false" ? false : raw;
        $$(`[data-k="${k}"]`, s).forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
        saveF(); renderProps(); const d = $("[data-close].primary", s); if (d) d.textContent = `Show ${filtered().length} props`;
      }
      if (e.target.closest("[data-reset]")) { state.f = { agree: 1, book: "all", market: "all", sort: "edge", watch: false, started: false }; saveF(); renderProps(); closeSheet(); }
    });
  });

  // list interactions: tap, quick add, swipe
  $("#list").addEventListener("click", (e) => {
    const q = e.target.closest("[data-quick]");
    if (q) { e.stopPropagation(); toggleLeg(propLeg(shown[Number(q.dataset.quick)])); renderProps(); return; }
    const sw = e.target.closest(".swipe");
    if (sw && !sw.dataset.swiped) openPlayer(shown[Number(sw.dataset.i)]);
  });
  (function swipe() {
    let el = null, x0 = 0, y0 = 0, dx = 0, active = false;
    $("#list").addEventListener("pointerdown", (e) => {
      const sw = e.target.closest(".swipe"); if (!sw || e.target.closest("button")) return;
      el = sw; x0 = e.clientX; y0 = e.clientY; dx = 0; active = false; delete sw.dataset.swiped;
    });
    $("#list").addEventListener("pointermove", (e) => {
      if (!el) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!active) { if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.4) { active = true; el.firstElementChild.style.background = "var(--surface-2)"; } else if (Math.abs(my) > 12) { el = null; return; } else return; }
      dx = mx; const c = $(".card", el); c.classList.add("dragging"); c.style.transform = `translateX(${dx}px)`;
      el.firstElementChild.style.background = dx > 0 ? "var(--accent-soft)" : "var(--surface-2)";
    });
    const end = () => {
      if (!el) return; const c = $(".card", el), sw = el; el = null;
      c.classList.remove("dragging");
      if (!active) return;
      sw.dataset.swiped = "1"; setTimeout(() => delete sw.dataset.swiped, 50);
      const r = shown[Number(sw.dataset.i)];
      if (dx > 90) { c.style.transform = "translateX(0)"; if (!inSlip(r)) toggleLeg(propLeg(r)); else toast("Already on the slip"); setTimeout(renderProps, 220); }
      else if (dx < -90) {
        c.style.transform = "translateX(-110%)"; c.style.opacity = "0";
        setTimeout(() => { state.hidden.add(rowKey(r)); saveHidden(); renderProps(); toast("Hidden", { label: "Undo", fn: () => { state.hidden.delete(rowKey(r)); saveHidden(); renderProps(); } }); }, 200);
      } else c.style.transform = "translateX(0)";
    };
    $("#list").addEventListener("pointerup", end); $("#list").addEventListener("pointercancel", end);
  })();
  const saveHidden = () => store.set("archer-hidden", { asOf: state.asOf, keys: [...state.hidden] });

  // ------------------------------------------------------------------ sheets
  let sheetEl = null;
  function openSheet(html, full) {
    closeSheet(true);
    const s = document.createElement("div"); s.className = `sheet ${full ? "full" : ""}`;
    s.innerHTML = `<div class="in" role="dialog">${full ? "" : '<div class="grab"></div>'}${html}</div>`;
    s.addEventListener("click", (e) => { if (e.target === s || e.target.closest("[data-close]")) closeSheet(); });
    document.body.appendChild(s); document.body.classList.add("locked"); sheetEl = s;
    history.pushState({ sheet: 1 }, "");
    return s;
  }
  function closeSheet(silent) {
    if (!sheetEl) return;
    sheetEl.remove(); sheetEl = null; document.body.classList.remove("locked");
    if (!silent && history.state && history.state.sheet) history.back();
  }
  window.addEventListener("popstate", () => { if (sheetEl) { sheetEl.remove(); sheetEl = null; document.body.classList.remove("locked"); } });

  // ------------------------------------------------------------------ charts
  // recent_games: "date|opponent|vs|@" per game, most recent first (same order as the values)
  function gameLog(r) {
    const vals = String(r.recent_values || "").split(",").map((x) => x.trim()).filter((x) => x !== "").map(Number);
    const games = String(r.recent_games || "").split(";");
    const lg = leagueOf(r);
    return vals.map((v, i) => {
      const [date, opp, ha] = (games[i] || "").split("|");
      const d = date ? new Date(date + "T12:00:00") : null;
      return { v, opp: opp || "", oppShort: opp ? String(abbr(lg, opp)).slice(0, 5) : "", ha: ha === "@" ? "@" : "vs",
        date: d && !isNaN(d) ? `${d.getMonth() + 1}/${d.getDate()}` : "", long: d && !isNaN(d) ? d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined }) : "" };
    });
  }
  function gameLogChart(games, line, side) {
    if (!games.length) return "";
    const g = games.slice().reverse(); // oldest -> newest
    const W = 340, H = 186, top = 18, base = 132, left = 44, pad = 12, n = g.length, mx = Math.max(line * 1.4, ...g.map((x) => x.v)) || 1;
    const bw = (W - left - pad) / n, y = (v) => base - (v / mx) * (base - top);
    const bars = g.map((x, i) => {
      const hit = side === "over" ? x.v > line : x.v < line, cx = left + i * bw + bw / 2;
      const bx = left + i * bw + bw * 0.15, h = Math.max(1, base - y(x.v));
      return `<rect x="${bx}" y="${y(x.v)}" width="${bw * 0.7}" height="${h}" rx="4" fill="${hit ? "var(--accent)" : "var(--red)"}" opacity="${hit ? 0.95 : 0.7}"><animate attributeName="height" from="0" to="${h}" dur=".5s"/><animate attributeName="y" from="${base}" to="${y(x.v)}" dur=".5s"/></rect>
        <text x="${cx}" y="${y(x.v) - 5}" text-anchor="middle" class="lbl2">${x.v}</text>
        <text x="${cx}" y="${base + 16}" text-anchor="middle" class="lbl2" style="font-size:10.5px">${esc(x.oppShort ? (x.ha === "@" ? "@" : "") + x.oppShort : "")}</text>
        <text x="${cx}" y="${base + 30}" text-anchor="middle" style="font-size:10px">${esc(x.date)}</text>`;
    }).join("");
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Last ${n} games against the line ${line}">
      ${bars}<line x1="${left - 4}" x2="${W - pad + 4}" y1="${y(line)}" y2="${y(line)}" stroke="var(--ink)" stroke-dasharray="5 4" stroke-width="1.5"/>
      <text x="0" y="${y(line) + 4}" class="lbl2">${line}</text>
      <text x="${left}" y="${H - 2}" style="font-size:10px">oldest</text><text x="${W - pad}" y="${H - 2}" text-anchor="end" style="font-size:10px">latest</text></svg>`;
  }
  function gameLogList(games, line, side, league) {
    if (!games.length || !games.some((x) => x.opp)) return "";
    return `<div class="glog">${games.map((x) => {
      const hit = side === "over" ? x.v > line : x.v < line;
      return `<div class="gl"><span class="d">${esc(x.long || "—")}</span><span class="o">${logoImg(league, x.opp)}${esc(x.ha)} ${esc(abbr(league, x.opp) || "—")}</span><span class="v ${hit ? "y" : "n"}">${x.v}</span></div>`;
    }).join("")}</div>`;
  }
  function curveChart(mean, sd, line, side, marks) {
    if (mean == null || !sd) return "";
    const W = 340, H = 130, pad = 16, lo = Math.max(0, mean - 3.2 * sd), hi = mean + 3.2 * sd;
    const X = (v) => pad + ((v - lo) / (hi - lo)) * (W - pad * 2), pdf = (v) => Math.exp(-0.5 * ((v - mean) / sd) ** 2);
    const pts = []; for (let i = 0; i <= 80; i++) { const v = lo + ((hi - lo) * i) / 80; pts.push([X(v), H - 26 - pdf(v) * (H - 46)]); }
    const path = "M" + pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join("L");
    const inSide = pts.filter(([x]) => (side === "over" ? x >= X(line) : x <= X(line)));
    const area = inSide.length ? `M${inSide[0][0]},${H - 26}L` + inSide.map((p) => p.join(",")).join("L") + `L${inSide[inSide.length - 1][0]},${H - 26}Z` : "";
    const shownMarks = (marks || []).filter((m) => m.v != null && m.v >= lo && m.v <= hi);
    const mk = shownMarks.map((m) => `<line x1="${X(m.v)}" x2="${X(m.v)}" y1="14" y2="${H - 26}" stroke="${m.c}" stroke-width="2.2"/>`).join("");
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Projection range against the line">
      <path d="${area}" fill="var(--accent)" opacity=".22"/><path d="${path}" fill="none" stroke="var(--ink-2)" stroke-width="2"/>
      <line x1="${X(line)}" x2="${X(line)}" y1="8" y2="${H - 26}" stroke="var(--ink)" stroke-dasharray="4 3" stroke-width="1.5"/>
      <text x="${X(line)}" y="${H - 10}" text-anchor="middle" class="lbl2">line ${line}</text>${mk}</svg>
      <div class="legend">${shownMarks.map((m) => `<span><i style="background:${m.c}"></i>${esc(m.t)} ${Number(m.v).toFixed(1)}</span>`).join("")}</div>`;
  }

  // ------------------------------------------------------------------ player sheet
  function openPlayer(r) {
    if (!r) return;
    const lg = leagueOf(r), be = r.breakeven_p ?? 0.524, t = team(lg, r.form_team), over = r.side === "over", w = when(r.commence_time);
    const glog = gameLog(r), vals = glog.map((x) => x.v);
    const others = state.rows.filter((x) => x.event_id === r.event_id && x.market === r.market && x.side === r.side && normName(x.player_ref) === normName(r.player_ref));
    const cmp = others.map((x) => `<div class="r ${x === r ? "me" : ""}"><span><span class="sw" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${DOT[x.book] || "#94A3B8"};margin-right:6px"></span>${esc(bookName(x.book))}<small> · ${x.dfs ? "needs " + pct(x.breakeven_p) : odds(x.price)}</small></span><b>${x.line}</b><small>${pct(x.p_model)}</small></div>`).join("")
      + (r.ref_book && r.ref_line != null ? `<div class="r"><span>${esc(bookName(r.ref_book))}<small> · sportsbook reference</small></span><b>${r.ref_line}</b><small>ref</small></div>` : "");
    const watched = state.watch.has(normName(r.player_ref));
    const marks = [{ v: r.form_mean, t: "form", c: "var(--ink-2)" }, { v: r.proj_mean, t: "matchup", c: "var(--accent-2)" }, { v: r.pff_mean, t: "PFF", c: "#A78BFA" }];
    const s = openSheet(`<div class="sh-top"><button class="btn small" data-close>✕ Close</button><div class="r">
        <button class="btn small" data-watch>${watched ? "★ Watching" : "☆ Watch"}</button><button class="btn small" data-share>Share</button></div></div>
      <div class="hero" style="--tc:${esc((t && t.color) || "#334155")}">
        <div class="h1">${avatar(r.player_ref, lg, r.form_team, "lg")}<div><div class="nm2">${esc(r.player_ref)}</div>
          <div class="sub2">${ctxLine(r)}${r.status ? ` · <span class="st ${r.status === "OUT" ? "out" : "q"}">${esc(r.status)}</span>` : ""}</div></div></div>
        <div class="bigpick"><div><div class="l1">${esc(r.market_label || LABEL[r.market] || r.market)} · ${esc(bookName(r.book))}</div><div class="l2">${over ? "OVER" : "UNDER"} ${r.line}</div>
          <div class="subrow">${verdictChip(r)}${movement(r)}</div></div>
          <div class="pr2"><b>${pct(r.p_model)}</b><span>best estimate · needs ${pct(be)}${r.dfs ? "" : " at " + odds(r.price)}</span></div></div>
      </div>
      ${w.locked ? `<div class="note-card"><b>Game has started.</b> This line is locked; shown for reference.</div>` : ""}
      <div class="panel"><h3><span>Last ${vals.length} games</span><span style="text-transform:none;letter-spacing:0">${vals.filter((v) => (over ? v > r.line : v < r.line)).length} of ${vals.length} ${over ? "over" : "under"}</span></h3>${gameLogChart(glog, Number(r.line), r.side) || '<div class="empty" style="padding:14px">No game log</div>'}${gameLogList(glog, Number(r.line), r.side, lg)}</div>
      ${r.form_sd ? `<div class="panel"><h3><span>Projection range</span><span style="text-transform:none;letter-spacing:0">shaded = your side</span></h3>${curveChart(r.proj_mean ?? r.form_mean, r.proj_sd || r.form_sd, Number(r.line), r.side, marks)}</div>` : ""}
      <div class="panel"><h3><span>Chances</span><span style="text-transform:none;letter-spacing:0">tick = break-even</span></h3>${meters(r, be)}</div>
      ${others.length > 1 || r.ref_book ? `<div class="panel"><h3>Lines across apps</h3><div class="cmp">${cmp}</div></div>` : ""}
      <div class="panel"><h3>Why</h3><ul class="whys">${(r.why_points || []).map((x) => `<li class="${String(x).startsWith("PFF") ? "pff" : ""}">${esc(x)}</li>`).join("") || `<li>${esc(r.why_long || "—")}</li>`}</ul></div>
      <div class="actions"><button class="btn primary grow" data-add>${inSlip(r) ? "✓ On your slip" : "+ Add to slip"}</button><button class="btn grow" data-track>Track as single</button></div>`, true);
    s.addEventListener("click", (e) => {
      if (e.target.closest("[data-add]")) { toggleLeg(propLeg(r)); e.target.closest("[data-add]").textContent = inSlip(r) ? "✓ On your slip" : "+ Add to slip"; renderProps(); }
      if (e.target.closest("[data-track]")) trackSingle(propLeg(r));
      if (e.target.closest("[data-share]")) shareCard(r);
      if (e.target.closest("[data-watch]")) {
        const k = normName(r.player_ref); state.watch.has(k) ? state.watch.delete(k) : state.watch.add(k);
        store.set("archer-watch", [...state.watch]); e.target.closest("[data-watch]").textContent = state.watch.has(k) ? "★ Watching" : "☆ Watch"; buzz(); renderProps();
      }
    });
  }

  // share card
  function shareCard(r) {
    const c = document.createElement("canvas"); c.width = 1080; c.height = 1350; const x = c.getContext("2d");
    const lg = leagueOf(r), t = team(lg, r.form_team), col = (t && t.color) || "#10B981";
    const g = x.createLinearGradient(0, 0, 1080, 1350); g.addColorStop(0, col); g.addColorStop(0.55, "#0B1220"); g.addColorStop(1, "#070B12");
    x.fillStyle = g; x.fillRect(0, 0, 1080, 1350);
    // mark
    x.save(); x.translate(80, 80); x.fillStyle = "#0E1520"; x.beginPath(); x.roundRect(0, 0, 120, 120, 28); x.fill();
    x.strokeStyle = "rgba(110,231,183,.35)"; x.lineWidth = 6; x.beginPath(); x.arc(50, 70, 30, 0, 7); x.stroke(); x.beginPath(); x.arc(50, 70, 17, 0, 7); x.stroke();
    x.strokeStyle = "#34D399"; x.lineWidth = 9; x.lineCap = "round"; x.beginPath(); x.moveTo(50, 70); x.lineTo(90, 30); x.stroke();
    x.beginPath(); x.moveTo(70, 28); x.lineTo(92, 28); x.lineTo(92, 50); x.stroke(); x.restore();
    const font = (w, s, f) => `${w} ${s}px ${f || "'Barlow Condensed', Inter, sans-serif"}`;
    x.fillStyle = "#EAF0F7"; x.font = font(800, 64); x.fillText("ARCHER", 230, 150); x.fillStyle = "#34D399"; x.font = font(600, 26, "Inter, sans-serif"); x.fillText("A N A L Y T I C S", 232, 190);
    x.fillStyle = "#EAF0F7"; x.font = font(700, 110); x.fillText(r.player_ref, 80, 470);
    x.fillStyle = "#A5B3C6"; x.font = font(500, 40, "Inter, sans-serif"); x.fillText(`${r.market_label || LABEL[r.market] || r.market} · ${bookName(r.book)}${r.opponent ? " · vs " + r.opponent : ""}`, 84, 540);
    x.fillStyle = r.side === "over" ? "#34D399" : "#7CB4FB"; x.font = font(800, 200); x.fillText(`${r.side === "over" ? "OVER" : "UNDER"} ${r.line}`, 76, 800);
    x.fillStyle = "#EAF0F7"; x.font = font(700, 120); x.fillText(pct(r.p_model), 80, 1010);
    x.fillStyle = "#A5B3C6"; x.font = font(500, 36, "Inter, sans-serif"); x.fillText(`best estimate · needs ${pct(r.breakeven_p)}`, 84, 1070);
    x.fillStyle = "#F59E0B"; x.font = font(700, 30, "Inter, sans-serif"); x.fillText("UNVALIDATED MODEL · NOT BETTING ADVICE", 84, 1270);
    c.toBlob(async (b) => {
      const file = new File([b], `archer-${normName(r.player_ref).replace(/ /g, "-")}.png`, { type: "image/png" });
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Archer pick" }); return; } } catch (_) { return; }
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast("Image saved");
    }, "image/png");
  }

  // ------------------------------------------------------------------ games
  const COLS = {
    nfl: { QB: [["pass_att", "Att"], ["pass_cmp", "Cmp"], ["pass_yds", "Yds"], ["pass_td", "TD"], ["int", "INT"], ["rush_yds", "RuYd"]], RB: [["rush_att", "Car"], ["rush_yds", "RuYd"], ["targets", "Tgt"], ["rec", "Rec"], ["rec_yds", "ReYd"]], WR: [["targets", "Tgt"], ["rec", "Rec"], ["rec_yds", "ReYd"]], TE: [["targets", "Tgt"], ["rec", "Rec"], ["rec_yds", "ReYd"]] },
    cfb: { QB: [["pass_yds", "Yds"], ["pass_td", "TD"], ["int", "INT"], ["rush_att", "Car"], ["rush_yds", "RuYd"]], RB: [["rush_att", "Car"], ["rush_yds", "RuYd"], ["rush_td", "TD"], ["rec", "Rec"], ["rec_yds", "ReYd"]], WR: [["rec", "Rec"], ["rec_yds", "ReYd"], ["rec_td", "TD"]], TE: [["rec", "Rec"], ["rec_yds", "ReYd"], ["rec_td", "TD"]] },
  };
  function teamTable(id, blk, league) {
    if (!blk) return "";
    const sub = league === "nfl" ? `implied ${fmt1(blk.implied_points)} pts · QB att ${fmt1(blk.qb_pass_att)}` : `model ${fmt1(blk.model_points)} pts · recent ${fmt1(blk.recent_points)}`;
    const t = team(league, id);
    let html = `<div class="team-h">${logoImg(league, id)}<b>${esc((t && t.name) || id)}</b><span>${sub}</span></div>`;
    if (blk.qb_change) html += `<div class="outs"><b>QB change:</b> ${esc(blk.qb_change)} starts.</div>`;
    if (blk.out && blk.out.length) html += `<div class="outs"><b>Out:</b> ${blk.out.map((o) => esc(o.player) + " (" + esc(o.pos) + ")").join(", ")}</div>`;
    for (const g of ["QB", "RB", "WR", "TE"]) {
      const ps = (blk.players || []).filter((p) => p.pos === g); if (!ps.length) continue;
      const cols = COLS[league][g];
      html += `<table class="pl"><thead><tr><th>${g}</th>${cols.map((c) => `<th>${c[1]}</th>`).join("")}</tr></thead><tbody>`;
      for (const p of ps) { const f = face(league, p.player, id); html += `<tr><td>${faceImg(f, "mini")}${esc(p.player)}${p.status === "Q" ? ' <span class="st q">Q</span>' : ""}</td>${cols.map((c) => `<td>${fmt1(p.proj[c[0]])}</td>`).join("")}</tr>`; }
      html += `</tbody></table>`;
    }
    return html;
  }
  function gameLegs(g, league) {
    const legs = [], date = String(g.kickoff_utc || "").slice(0, 10), base = { kind: "game", league, home: g.home, away: g.away, date, event: g.game_id, kick: g.kickoff_utc };
    const add = (key, label, short, side, line) => side && side.price != null && legs.push({ ...base, id: `g|${g.game_id}|${key}`, bet: key, label, short, line, price: side.price, p: side.p, edge: side.edge, be: side.breakeven });
    if (g.spread) { const hl = g.spread.home_line; add("spread_home", `${g.home} ${hl > 0 ? "+" : ""}${hl}`, `${hl > 0 ? "+" : ""}${hl}`, g.spread.home, hl); add("spread_away", `${g.away} ${-hl > 0 ? "+" : ""}${-hl}`, `${-hl > 0 ? "+" : ""}${-hl}`, g.spread.away, hl); }
    if (g.total) { add("over", `${g.away}/${g.home} over ${g.total.line}`, `O ${g.total.line}`, g.total.over, g.total.line); add("under", `${g.away}/${g.home} under ${g.total.line}`, `U ${g.total.line}`, g.total.under, g.total.line); }
    if (g.moneyline) { add("ml_home", `${g.home} ML`, "ML", g.moneyline.home, null); add("ml_away", `${g.away} ML`, "ML", g.moneyline.away, null); }
    return legs;
  }
  let legIndex = [];
  function lineCell(leg, flagged) {
    if (!leg) return `<div class="cell"><div class="sub">no line</div></div>`;
    const pos = leg.edge != null && leg.edge > 0; legIndex.push(leg);
    return `<div class="cell ${pos && flagged ? "pos" : ""}"><div class="top2"><span>${esc(leg.short)}</span><span class="pr">${odds(leg.price)}</span></div><div class="sub">model <b style="color:var(--ink)">${pct(leg.p)}</b> / ${pct(leg.be)}</div><button data-gleg="${legIndex.length - 1}">+ Slip</button></div>`;
  }
  function linesGrid(g, league) {
    const flags = (state.games.meta?.game_model?.[league]?.flags) || {}, by = Object.fromEntries(gameLegs(g, league).map((l) => [l.bet, l]));
    if (!(g.spread || g.total || g.moneyline)) return g.model ? `<div class="sub" style="font-size:12px;color:var(--ink-3);margin-top:8px">No Hard Rock lines yet for this game.</div>` : "";
    return `<div class="lines"><div></div><div class="hd c">${esc(abbr(league, g.away))}</div><div class="hd c">${esc(abbr(league, g.home))}</div>
      <div class="hd">Spread</div>${lineCell(by.spread_away, flags.ats)}${lineCell(by.spread_home, flags.ats)}
      <div class="hd">Total</div>${lineCell(by.over, flags.totals)}${lineCell(by.under, flags.totals)}
      <div class="hd">Money</div>${lineCell(by.ml_away, flags.ats)}${lineCell(by.ml_home, flags.ats)}</div>`;
  }
  function wpBar(g, league) {
    const m = g.model; if (!m || m.home_win_p == null) return "";
    const ta = team(league, g.away), th = team(league, g.home), h = m.home_win_p;
    return `<div class="wp"><span style="width:${(1 - h) * 100}%;background:${esc((ta && ta.color) || "#64748B")}"></span><span style="width:${h * 100}%;background:${esc((th && th.color) || "#94A3B8")}"></span></div>
      <div class="wpl"><span>${esc(abbr(league, g.away))} ${pct(1 - h)}</span><span>model win chance</span><span>${pct(h)} ${esc(abbr(league, g.home))}</span></div>`;
  }
  function gameRows(g, league) {
    return state.rows.filter((r) => leagueOf(r) === league && teamId(league, r.home_team) === g.home && teamId(league, r.away_team) === g.away);
  }
  function trow(league, id, pts, win, sub) {
    const t = team(league, id);
    return `<div class="trow">${logoBox(league, id)}<div class="tn">${esc((t && t.name) || id)}<small>${esc(sub)}</small></div><div class="pts ${pts == null ? "" : win ? "" : "lose"}">${pts == null ? "" : fmt1(pts)}</div></div>`;
  }
  function gameCard(g, league, i) {
    const m = g.model, w = when(g.kickoff_utc);
    const market = g.spread_line != null ? `${g.spread_line > 0 ? abbr(league, g.home) + " −" + g.spread_line : g.spread_line < 0 ? abbr(league, g.away) + " " + g.spread_line : "Pick"} · O/U ${g.total_line ?? "—"}` : "";
    const nProps = gameRows(g, league).length;
    return `<div class="gcard" data-g="${i}">
      <div class="gtop"><span><span class="when ${w.cls}">${esc(w.txt || g.kickoff || "")}</span>${g.week ? " · Wk " + g.week : ""}</span><span class="mk">${esc(market)}</span></div>
      <div class="teams">${trow(league, g.away, m ? m.away : null, m && m.away > m.home, "Away")}${trow(league, g.home, m ? m.home : null, m && m.home >= m.away, "Home")}</div>
      ${wpBar(g, league)}${linesGrid(g, league)}
      ${(g.mismatches || []).length ? `<div class="mism"><span class="h">PFF matchups · unvalidated</span>${g.mismatches.slice(0, 2).map((x) => `<div class="i">${esc(x)}</div>`).join("")}</div>` : ""}
      <div class="glink"><span>Matchup page${nProps ? ` · ${nProps} props` : ""}</span><span>›</span></div></div>`;
  }
  let gamesShown = [];
  const localDate = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return d.toDateString(); };
  const gameDate = (g) => { const k = g.kickoff_utc ? new Date(g.kickoff_utc) : g.kickoff ? new Date(String(g.kickoff).slice(0, 10) + "T12:00:00") : null; return k && !isNaN(k) ? k.toDateString() : ""; };
  function renderGames() {
    const league = state.league, all = (league === "cfb" ? state.games.cfb_games : state.games.games) || [];
    let games = all;
    if (state.day === "today") games = games.filter((g) => gameDate(g) === localDate(0));
    if (state.day === "tomorrow") games = games.filter((g) => gameDate(g) === localDate(1));
    const gm = state.games.meta?.game_model?.[league], bt = gm?.backtest, row = bt?.ats?.find((r) => r.min_diff === 3), tot = bt?.totals?.find((r) => r.min_diff === 3), flagged = gm?.flags?.ats || gm?.flags?.totals;
    $("#modelNote").innerHTML = (bt
      ? `<b>${league === "cfb" ? "College" : "NFL"} game model, 2023–25 backtest:</b> sides ${row ? (row.win_rate * 100).toFixed(1) + "% (" + row.wins + "–" + row.losses + ")" : "—"}, totals ${tot ? (tot.win_rate * 100).toFixed(1) + "% (" + tot.wins + "–" + tot.losses + ")" : "—"} when it disagreed with the closing line by 3+ points; 52.4% breaks even. ${flagged ? "Green cells are backed by that record." : "<b>No edge found — scores are information only.</b>"}`
      : `<b>${league === "cfb" ? "College" : "NFL"} game model not backtested yet</b> — information only.`)
      + (gm?.book && gm.book !== "hardrockbet_fl" ? ` <b>Lines: Hard Rock national feed</b> — check the price in your app.` : "");
    legIndex = [];
    gamesShown = games.slice().sort((a, b) => String(a.kickoff_utc || a.kickoff).localeCompare(String(b.kickoff_utc || b.kickoff)));
    $("#gmeta").textContent = all.length ? `${gamesShown.length} of ${all.length}` : "";
    $("#games").innerHTML = gamesShown.length ? gamesShown.map((g, i) => gameCard(g, league, i)).join("")
      : `<div class="empty"><b>${all.length ? "No games that day" : "No games yet"}</b>${all.length ? "Try All games." : "Games publish with the next board."}</div>`;
  }
  $("#games").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-gleg]");
    if (b) { e.stopPropagation(); toggleLeg(legIndex[Number(b.dataset.gleg)]); return; }
    const c = e.target.closest("[data-g]"); if (c) openGame(gamesShown[Number(c.dataset.g)], state.league);
  });
  $("#dayFilters").addEventListener("click", (e) => { const b = e.target.closest("[data-day]"); if (!b) return; state.day = b.dataset.day; $$("#dayFilters .chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); renderGames(); });

  function battleRow(b, league) {
    const fmt = (v) => (b.fmt === "pct" ? pct(v) : b.fmt === "ypr" ? Number(v).toFixed(2) : Number(v).toFixed(1));
    const ratio = b.league ? b.value / b.league : 1, off = team(league, b.off), dfn = team(league, b.def);
    // push from the middle toward whoever the number favours
    const favours = b.good_for === "def" ? (ratio > 1 ? "def" : "off") : b.good_for === "off" ? (ratio > 1 ? "off" : "def") : null;
    const size = Math.min(50, Math.abs(ratio - 1) * 160);
    const col = favours === "off" ? (off && off.color) || "var(--accent)" : (dfn && dfn.color) || "var(--blue)";
    const bar = favours ? `<i style="${favours === "off" ? "right:50%" : "left:50%"};width:${size}%;background:${esc(col)}"></i>` : `<i style="left:0;width:${Math.min(100, b.value * 100)}%;background:var(--violet)"></i>`;
    const who = favours ? (favours === "off" ? abbr(league, b.off) : abbr(league, b.def)) + " edge" : "";
    const label = String(b.label || `${b.off} ${b.unit}`).replace(new RegExp(`\\b(${[b.off, b.def].map((x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "g"), (m) => abbr(league, m));
    return `<div class="battle"><div class="t"><span>${esc(label)}</span><span>${fmt(b.value)} · league ${fmt(b.league)}</span></div>
      <div class="tug">${favours ? '<span class="mid"></span>' : ""}${bar}</div><div class="lg2"><span>${favours ? esc(abbr(league, b.off)) + " offense" : ""}</span><span>${esc(who)}</span><span>${favours ? esc(abbr(league, b.def)) + " defense" : ""}</span></div></div>`;
  }
  function openGame(g, league) {
    if (!g) return;
    const ta = team(league, g.away), th = team(league, g.home), m = g.model, w = when(g.kickoff_utc);
    const rows = gameRows(g, league).sort((x, y) => (y.fav ? 1 : 0) - (x.fav ? 1 : 0) || (y.agree_count ?? 0) - (x.agree_count ?? 0) || (y.edge ?? -9) - (x.edge ?? -9));
    legIndex = [];
    const big = (id) => { const t = team(league, id); return t && t.logo ? `<img src="${esc(t.logo)}" alt="" onerror="this.outerHTML='<span class=&quot;fb&quot;>${esc(abbr(league, id))}</span>'">` : `<span class="fb" style="--tc:${esc((t && t.color) || "#334155")}">${esc(abbr(league, id))}</span>`; };
    const s = openSheet(`<div class="sh-top"><button class="btn small" data-close>✕ Close</button><span class="when ${w.cls}" style="font-size:13px">${esc(w.txt)}${g.week ? " · Week " + g.week : ""}</span></div>
      <div class="ghero" style="--ca:${esc((ta && ta.color) || "#334155")};--ch:${esc((th && th.color) || "#334155")}">
        <div class="vs"><div>${big(g.away)}<div class="tnm">${esc((ta && ta.name) || g.away)}</div><div class="sc">${m ? fmt1(m.away) : ""}</div></div>
          <div class="mid2">${m ? "model score" : "@"}</div>
          <div>${big(g.home)}<div class="tnm">${esc((th && th.name) || g.home)}</div><div class="sc">${m ? fmt1(m.home) : ""}</div></div></div>
        <div style="margin-top:12px">${wpBar(g, league)}</div></div>
      ${linesGrid(g, league) ? `<div class="panel"><h3>Hard Rock lines</h3>${linesGrid(g, league)}</div>` : ""}
      ${(g.battles || []).length ? `<div class="panel"><h3><span>Unit matchups</span><span style="text-transform:none;letter-spacing:0">PFF · unvalidated</span></h3>${g.battles.map((b) => battleRow(b, league)).join("")}</div>` : (g.mismatches || []).length ? `<div class="panel"><h3>PFF matchups</h3><div class="mism">${g.mismatches.map((x) => `<div class="i">${esc(x)}</div>`).join("")}</div></div>` : ""}
      ${rows.length ? `<div class="panel"><h3><span>Props in this game</span><span>${rows.length}</span></h3><div id="gprops"></div></div>` : ""}
      ${(g.teams && (g.teams[g.away] || g.teams[g.home])) ? `<div class="panel"><h3>Player projections</h3>${teamTable(g.away, g.teams[g.away], league)}${teamTable(g.home, g.teams[g.home], league)}</div>` : ""}`, true);
    const gp = $("#gprops", s);
    if (gp) gp.innerHTML = rows.slice(0, 40).map((r, k) => `<div class="partner" data-gp="${k}" style="cursor:pointer">${avatar(r.player_ref, league, r.form_team, "sm")}<div class="who"><b>${esc(r.player_ref)}</b><small>${esc(LABEL[r.market] || r.market)} ${r.side === "over" ? "O" : "U"} ${r.line} · ${esc(bookName(r.book))}</small></div>${verdictChip(r) || `<span class="tag">${pct(r.p_model)}</span>`}</div>`).join("");
    s.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-gleg]"); if (b) { toggleLeg(legIndex[Number(b.dataset.gleg)]); return; }
      const p = e.target.closest("[data-gp]"); if (p) openPlayer(rows[Number(p.dataset.gp)]);
    });
  }

  // ------------------------------------------------------------------ slip & pick'em builder
  function saveSlip() { store.set("archer-slip-v1", state.slip); const c = $("#slipCount"); c.textContent = state.slip.length || ""; c.classList.toggle("hidden", !state.slip.length); }
  function toggleLeg(leg) {
    if (!leg) return;
    const i = state.slip.findIndex((l) => l.id === leg.id);
    if (i >= 0) { state.slip.splice(i, 1); saveSlip(); renderSlip(); toast("Removed from slip"); return; }
    state.slip.push(leg); saveSlip(); renderSlip(); buzz();
    toast(`Added · ${leg.label}`, { label: "View slip", fn: () => show("slip") });
  }
  function hitDist(ps) { // Poisson-binomial: P(exactly k hits)
    let d = [1];
    for (const p of ps) { const n = new Array(d.length + 1).fill(0); d.forEach((v, k) => { n[k] += v * (1 - p); n[k + 1] += v * p; }); d = n; }
    return d;
  }
  function entryOptions(picks) {
    const pay = (state.meta.pickem && state.meta.pickem.payouts) || {}, n = picks.length, ps = picks.map((l) => l.p), dist = hitDist(ps);
    const apps = [...new Set(picks.map((l) => l.book))], out = [];
    for (const app of apps.length === 1 ? apps : Object.keys(pay)) {
      const p = pay[app]; if (!p) continue;
      if (p.power && p.power[n]) out.push({ app, kind: "Power", m: p.power[n], ev: dist[n] * p.power[n] - 1, note: `all ${n} hit` });
      if (p.flex && p.flex[n]) { const tbl = p.flex[n]; const r = tbl.reduce((a, mult, j) => a + (dist[n - j] || 0) * mult, 0); out.push({ app, kind: "Flex", m: tbl[0], ev: r - 1, note: tbl.map((mult, j) => `${n - j}/${n} → ${mult}x`).join(" · ") }); }
    }
    return out.sort((a, b) => b.ev - a.ev);
  }
  function renderBuilder() {
    const picks = state.slip.filter((l) => l.dfs);
    if (!picks.length) { $("#builder").innerHTML = ""; return; }
    const known = picks.every((l) => l.p != null), events = picks.map((l) => l.event), same = events.length !== new Set(events).size;
    const apps = [...new Set(picks.map((l) => l.book))];
    const all = known ? picks.reduce((a, l) => a * l.p, 1) : null;
    const opts = known && picks.length >= 2 ? entryOptions(picks) : [];
    const used = new Set(picks.map((l) => l.id)), app = apps[0];
    const partners = state.rows.filter((r) => r.dfs && r.book === app && !when(r.commence_time).locked && (r.agree_count ?? 0) >= 2 && !events.includes(r.event_id) && !used.has(propLeg(r).id) && !picks.some((l) => l.name_key === normName(r.player_ref)))
      .sort((x, y) => (y.p_model ?? 0) - (x.p_model ?? 0)).slice(0, 4);
    state.partners = partners;
    $("#builder").innerHTML = `<div class="panel"><h3><span>Pick'em entry · ${picks.length} pick${picks.length > 1 ? "s" : ""}</span><span style="text-transform:none;letter-spacing:0">${esc(apps.map(bookName).join(" + "))}</span></h3>
      <dl class="calc" style="margin-top:0"><dt>Model's chance all hit</dt><dd>${all == null ? "—" : pct(all, 1)}</dd><dt>Worth playing if it pays more than</dt><dd>${all ? (1 / all).toFixed(1) + "x" : "—"}</dd></dl>
      ${apps.length > 1 ? `<div class="note-card" style="margin:8px 0 0">These picks are on different apps — an entry has to be on one app.</div>` : ""}
      ${same ? `<div class="note-card" style="margin:8px 0 0;color:var(--amber)">Two picks share a game, so their results are linked; the real chance differs from multiplying them.</div>` : ""}
      ${opts.length ? `<div style="margin-top:12px">${opts.map((o, k) => `<div class="entry ${k === 0 && o.ev > 0 ? "best" : ""}"><div><b>${esc(bookName(o.app))} ${picks.length}-pick ${o.kind}${o.kind === "Power" ? " · " + o.m + "x" : ""}</b><small>${esc(o.note)}</small></div><div class="ev ${o.ev >= 0 ? "pos" : "neg"}">${o.ev >= 0 ? "+" : ""}${(o.ev * 100).toFixed(1)}%<small style="display:block;font-size:11px;color:var(--ink-3)">expected return</small></div></div>`).join("")}<div class="foot" style="margin:4px 0 0">Payouts come from config — check them in your app. Picks treated as independent.</div></div>` : picks.length === 1 ? `<div class="foot" style="margin:8px 0 0">Add one or two more picks to see entry values.</div>` : ""}
      ${partners.length ? `<h3 style="margin-top:14px">Good partners on ${esc(bookName(app))}</h3>${partners.map((r, k) => `<div class="partner">${avatar(r.player_ref, leagueOf(r), r.form_team, "sm")}<div class="who"><b>${esc(r.player_ref)}</b><small>${esc(LABEL[r.market] || r.market)} ${r.side === "over" ? "O" : "U"} ${r.line} · ${pct(r.p_model)} · different game</small></div><button class="btn small" data-partner="${k}">+ Add</button></div>`).join("")}` : ""}
    </div>`;
  }
  $("#builder").addEventListener("click", (e) => { const b = e.target.closest("[data-partner]"); if (b) toggleLeg(propLeg(state.partners[Number(b.dataset.partner)])); });
  function renderSlip() {
    const legs = state.slip;
    $("#slip").innerHTML = legs.length ? legs.map((l, i) => `<div class="slip-leg"><div class="lbl">${esc(l.label)}<small>${esc(l.dfs ? l.app + " pick" : l.sub || (l.kind === "game" ? l.away + " @ " + l.home : l.kind))}${l.p != null ? " · model " + pct(l.p) : ""}${l.kick && when(l.kick).locked ? " · started" : ""}</small></div>
      ${l.dfs ? '<span class="tag">pick\'em</span>' : `<input class="inp" inputmode="numeric" value="${l.price ?? ""}" data-odds="${i}" aria-label="Odds">`}<button class="btn small danger" data-rm="${i}" aria-label="Remove">✕</button></div>`).join("")
      : `<div class="empty" style="padding:20px 10px"><b>Your slip is empty</b>Tap + on a prop, swipe a card right, or add a game line.</div>`;
    renderBuilder();
    const stake = Math.max(0, Number($("#stake").value) || 0);
    const valid = legs.filter((l) => !l.dfs && Number.isFinite(Number(l.price)) && Math.abs(Number(l.price)) >= 100);
    if (!valid.length) { $("#calc").innerHTML = `<dt style="grid-column:1/-1;color:var(--ink-3)">Sportsbook legs you add show their combined odds here.</dt>`; return; }
    const D = valid.reduce((a, l) => a * dec(Number(l.price)), 1), bookP = valid.reduce((a, l) => a * implied(Number(l.price)), 1);
    const modelP = valid.every((l) => l.p != null) ? valid.reduce((a, l) => a * l.p, 1) : null;
    const events = valid.map((l) => l.event).filter(Boolean), sameGame = events.length !== new Set(events).size;
    const ev = modelP != null ? modelP * (D - 1) * stake - (1 - modelP) * stake : null;
    $("#calc").innerHTML = `<dt>Parlay odds · ${valid.length} leg${valid.length > 1 ? "s" : ""}</dt><dd>${odds(toAmerican(D))} (${D.toFixed(2)}x)</dd>
      <dt>Pays on $${stake.toFixed(2)}</dt><dd>$${(stake * D).toFixed(2)}</dd><dt>Needs to hit</dt><dd>${pct(1 / D, 1)}</dd>
      <dt>Book's chance (with vig)</dt><dd>${pct(bookP, 1)}</dd><dt>Model's chance</dt><dd>${modelP == null ? "—" : pct(modelP, 1)}</dd>
      <dt>Expected profit</dt><dd style="color:${ev == null ? "inherit" : ev >= 0 ? "var(--accent-2)" : "var(--red)"}">${ev == null ? "—" : (ev >= 0 ? "+$" : "−$") + Math.abs(ev).toFixed(2)}</dd>
      ${sameGame ? `<dt class="w">Two legs share a game; books price same-game parlays with extra margin.</dt>` : ""}`;
  }
  $("#slip").addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (!b) return; state.slip.splice(Number(b.dataset.rm), 1); saveSlip(); renderSlip(); renderProps(); });
  $("#slip").addEventListener("input", (e) => { const i = e.target.dataset.odds; if (i == null) return; state.slip[Number(i)].price = Number(e.target.value); saveSlip(); renderSlip(); });
  $("#stake").addEventListener("input", renderSlip);
  $("#addManual").addEventListener("click", () => {
    const label = $("#manualLabel").value.trim(), price = Number($("#manualOdds").value);
    if (!label || !Number.isFinite(price) || Math.abs(price) < 100) { toast("Enter a description and odds like -110 or +150"); return; }
    toggleLeg({ id: "m|" + Date.now(), kind: "manual", label, price, p: null }); $("#manualLabel").value = ""; $("#manualOdds").value = "";
  });
  $("#clearSlip").addEventListener("click", () => { if (!state.slip.length) return; const old = state.slip; state.slip = []; saveSlip(); renderSlip(); renderProps(); toast("Slip cleared", { label: "Undo", fn: () => { state.slip = old; saveSlip(); renderSlip(); renderProps(); } }); });

  // ------------------------------------------------------------------ bets
  function saveBets() { store.set("archer-bets-v1", state.bets); }
  function newBet(legs, stake, mult) {
    const D = mult || legs.reduce((a, l) => a * dec(Number(l.price)), 1);
    return { id: "b" + Date.now() + Math.random().toString(36).slice(2, 6), placed: new Date().toISOString(), stake, legs: legs.map((l) => ({ ...l, result: null })), odds: toAmerican(D), status: "open", manual: false };
  }
  function trackSingle(leg) {
    if (leg.dfs) { if (!state.slip.some((l) => l.id === leg.id)) toggleLeg(leg); toast("Pick'em: build the entry in your slip, then track it with its payout", { label: "View slip", fn: () => { closeSheet(); show("slip"); } }); return; }
    const stake = Math.max(0, Number($("#stake").value) || 10);
    state.bets.unshift(newBet([leg], stake)); saveBets(); renderBets(); buzz(); toast(`Tracking $${stake} on ${leg.label}`);
  }
  $("#trackParlay").addEventListener("click", () => {
    const legs = state.slip.filter((l) => !l.dfs && Math.abs(Number(l.price)) >= 100), picks = state.slip.filter((l) => l.dfs);
    if (picks.length && !legs.length) {
      const best = picks.length >= 2 && picks.every((l) => l.p != null) ? entryOptions(picks)[0] : null;
      const m = Number(prompt(`Pick'em entry, ${picks.length} picks: what does it pay if all hit?`, best ? String(best.m) : ""));
      if (!(m > 1)) { toast("Enter the payout multiplier, like 5 or 10"); return; }
      state.bets.unshift(newBet(picks, Math.max(0, Number($("#stake").value) || 0), m));
      state.slip = []; saveSlip(); saveBets(); renderSlip(); renderBets(); renderProps(); toast("Pick'em entry tracked"); return;
    }
    if (picks.length) { toast("Track pick'em picks and sportsbook legs separately"); return; }
    if (!legs.length) { toast("The slip is empty"); return; }
    state.bets.unshift(newBet(legs, Math.max(0, Number($("#stake").value) || 0)));
    state.slip = []; saveSlip(); saveBets(); renderSlip(); renderBets(); renderProps(); toast("Parlay tracked");
  });
  $("#trackSingles").addEventListener("click", () => {
    const legs = state.slip.filter((l) => !l.dfs && Math.abs(Number(l.price)) >= 100);
    if (!legs.length) { toast("No sportsbook legs on the slip"); return; }
    const stake = Math.max(0, Number($("#stake").value) || 0);
    legs.forEach((l) => state.bets.unshift(newBet([l], stake)));
    state.slip = state.slip.filter((l) => l.dfs); saveSlip(); saveBets(); renderSlip(); renderBets(); renderProps(); toast(`${legs.length} singles tracked`);
  });
  const dayDiff = (a, b) => Math.abs((new Date(a + "T00:00:00Z") - new Date(b + "T00:00:00Z")) / 86400000);
  function gradeProp(league, nameKey, stat, side, line, date, res) {
    if (!res || !date || !stat) return null;
    const row = res.players.find((p) => p.league === league && p.name_key === nameKey && dayDiff(p.date, date) <= 1);
    if (!row) return null;
    const v = row.stats[stat];
    if (v == null) return { r: "void" };
    if (v === line) return { r: "push", v };
    return { r: (side === "over" ? v > line : v < line) ? "won" : "lost", v };
  }
  function gradeLeg(l, res) {
    if (!res || !l.date) return null;
    if (l.kind === "prop" && l.stat) { const g = gradeProp(l.league, l.name_key, l.stat, l.side, l.line, l.date, res); return g ? g.r : null; }
    if (l.kind === "game") {
      const g = res.games.find((x) => x.league === l.league && x.home === l.home && x.away === l.away && dayDiff(x.date, l.date) <= 1);
      if (!g) return null;
      const margin = g.home_score - g.away_score, total = g.home_score + g.away_score;
      const r = { spread_home: margin + l.line, spread_away: -(margin + l.line), over: total - l.line, under: l.line - total, ml_home: margin, ml_away: -margin }[l.bet];
      return r > 0 ? "won" : r < 0 ? "lost" : "push";
    }
    return null;
  }
  function settle(b) {
    if (b.manual) return;
    for (const l of b.legs) if (!l.result) l.result = gradeLeg(l, state.results);
    const rs = b.legs.map((l) => l.result);
    if (rs.includes("lost")) b.status = "lost";
    else if (rs.every((r) => r === "won" || r === "push" || r === "void")) b.status = rs.every((r) => r === "push" || r === "void") ? "push" : "won";
    else b.status = "open";
  }
  const isEntry = (b) => b.legs.some((l) => l.dfs);
  function payout(b) {
    if (b.status === "lost") return 0;
    if (b.status === "push" || b.status === "void") return b.stake;
    if (isEntry(b)) return b.stake * dec(Number(b.odds));
    return b.stake * b.legs.filter((l) => l.result !== "push" && l.result !== "void").reduce((a, l) => a * dec(Number(l.price)), 1);
  }
  const toWin = (b) => (isEntry(b) ? b.stake * (dec(Number(b.odds)) - 1) : b.stake * (b.legs.reduce((a, x) => a * dec(Number(x.price)), 1) - 1));
  function countUp(el) { $$("[data-count]", el).forEach((n) => { const to = Number(n.dataset.count), pre = n.dataset.pre || "", suf = n.dataset.suf || "", d = Number(n.dataset.d || 0); let t0 = null; const step = (ts) => { t0 = t0 || ts; const k = Math.min(1, (ts - t0) / 500); n.textContent = pre + (to * (1 - (1 - k) ** 3)).toFixed(d) + suf; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }); }
  function renderBets() {
    state.bets.forEach(settle); saveBets();
    const settled = state.bets.filter((b) => b.status !== "open"), staked = settled.reduce((a, b) => a + b.stake, 0), back = settled.reduce((a, b) => a + payout(b), 0);
    const w = settled.filter((b) => b.status === "won").length, l = settled.filter((b) => b.status === "lost").length, p = settled.length - w - l;
    const openStake = state.bets.filter((b) => b.status === "open").reduce((a, b) => a + b.stake, 0), profit = back - staked, cls = profit > 0 ? "good" : profit < 0 ? "bad" : "";
    $("#betSummary").innerHTML = `<div class="kpi"><b>${w}–${l}${p ? "–" + p : ""}</b><span>Record</span></div>
      <div class="kpi ${cls}"><b data-count="${Math.abs(profit)}" data-pre="${profit >= 0 ? "+$" : "−$"}">$0</b><span>Profit</span></div>
      <div class="kpi ${cls}"><b ${staked ? `data-count="${(profit / staked) * 100}" data-suf="%" data-d="1"` : ""}>${staked ? "0%" : "—"}</b><span>ROI</span></div>
      <div class="kpi"><b data-count="${openStake}" data-pre="$">$0</b><span>Open</span></div>`;
    countUp($("#betSummary"));
    let list = state.bets;
    if (state.betFilter === "open") list = list.filter((b) => b.status === "open");
    if (state.betFilter === "settled") list = list.filter((b) => b.status !== "open");
    $("#bets").innerHTML = list.length ? list.map((b) => `<div class="bet">
      <div class="top3"><b>${b.legs.length > 1 ? (isEntry(b) ? b.legs.length + "-pick entry" : b.legs.length + "-leg parlay") : esc(b.legs[0].label)}</b><span class="bst ${b.status}">${b.status}</span></div>
      ${b.legs.length > 1 ? `<ul class="whys" style="margin-top:8px">${b.legs.map((x) => `<li>${esc(x.label)} ${x.dfs ? "" : odds(x.price)}${x.result ? " — " + x.result : ""}</li>`).join("")}</ul>` : `<div class="meta2"><span>${esc(b.legs[0].sub || "")}</span></div>`}
      <div class="meta2"><span>$${b.stake.toFixed(2)} at ${odds(b.odds)} · ${new Date(b.placed).toLocaleDateString()}</span><span>${b.status === "open" ? "to win $" + toWin(b).toFixed(2) : "returned $" + payout(b).toFixed(2)}</span></div>
      <div class="actions"><button class="btn small" data-mark="won" data-bet="${b.id}">Won</button><button class="btn small" data-mark="lost" data-bet="${b.id}">Lost</button><button class="btn small" data-mark="push" data-bet="${b.id}">Push</button><button class="btn small" data-mark="auto" data-bet="${b.id}">Auto</button><button class="btn small ghost danger" data-del="${b.id}">Delete</button></div>
    </div>`).join("") : `<div class="empty"><b>${state.bets.length ? "Nothing here" : "No bets tracked yet"}</b>${state.bets.length ? "" : "Track a single from a player page, or a parlay or entry from the Slip."}</div>`;
  }
  $("#bets").addEventListener("click", (e) => {
    const m = e.target.closest("[data-mark]"), d = e.target.closest("[data-del]");
    if (m) { const b = state.bets.find((x) => x.id === m.dataset.bet); if (!b) return; if (m.dataset.mark === "auto") { b.manual = false; b.legs.forEach((x) => { x.result = null; }); } else { b.manual = true; b.status = m.dataset.mark; } saveBets(); renderBets(); }
    if (d) { const old = state.bets; state.bets = state.bets.filter((x) => x.id !== d.dataset.del); saveBets(); renderBets(); toast("Bet deleted", { label: "Undo", fn: () => { state.bets = old; saveBets(); renderBets(); } }); }
  });
  $("#betFilters").addEventListener("click", (e) => { const b = e.target.closest("[data-bets]"); if (!b) return; state.betFilter = b.dataset.bets; $$("#betFilters .chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); renderBets(); });
  const download = (name, text, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  $("#exportBets").addEventListener("click", () => download(`archer-bets-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state.bets, null, 1), "application/json"));
  $("#exportCsv").addEventListener("click", () => {
    const q = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
    const lines = [["placed", "legs", "odds", "stake", "status", "returned"].join(",")].concat(state.bets.map((b) => [b.placed, q(b.legs.map((l) => `${l.label} ${l.dfs ? "" : odds(l.price)}`).join(" | ")), b.odds, b.stake, b.status, b.status === "open" ? "" : payout(b).toFixed(2)].join(",")));
    download("archer-bets.csv", lines.join("\n"), "text/csv");
  });
  $("#importBets").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const got = JSON.parse(await f.text()); if (!Array.isArray(got)) throw 0; const ids = new Set(state.bets.map((b) => b.id)); got.forEach((b) => { if (b && b.id && !ids.has(b.id)) state.bets.push(b); }); saveBets(); renderBets(); toast(`Imported ${got.length} bets`); } catch (_) { toast("That file is not an Archer backup"); }
  });

  // ------------------------------------------------------------------ record (how we did)
  function gradedHistory() {
    const h = (state.history && state.history.rows) || [], res = state.results;
    return h.filter((r) => leagueOf(r) === state.league).map((r) => {
      const g = gradeProp(leagueOf(r), normName(r.player_ref), STAT_OF[r.market], r.side, Number(r.line), String(r.commence_time || "").slice(0, 10), res);
      return { ...r, grade: g ? g.r : null, actual: g ? g.v : null };
    }).filter((r) => r.grade === "won" || r.grade === "lost" || r.grade === "push");
  }
  function renderRecord() {
    const all = gradedHistory(), f = state.recFilter;
    const pick = all.filter((r) => (f === "fav" ? r.fav : f === "both" ? (r.agree_count ?? 0) >= 2 : (r.agree_count ?? 0) >= 1));
    const dec2 = pick.filter((r) => r.grade !== "push"), w = dec2.filter((r) => r.grade === "won").length, n = dec2.length;
    const need = n ? dec2.reduce((a, r) => a + (r.breakeven_p ?? 0.524), 0) / n : null;
    const profit = dec2.reduce((a, r) => a + (r.grade === "won" ? 1 / (r.breakeven_p || 0.524) - 1 : -1), 0);
    $("#recSub").textContent = state.history ? `last ${state.history.days || 14} days` : "";
    $("#recKpis").innerHTML = `<div class="kpi"><b>${w}–${n - w}</b><span>Record</span></div>
      <div class="kpi ${n && w / n >= (need || 0.524) ? "good" : n ? "bad" : ""}"><b>${n ? pct(w / n) : "—"}</b><span>Hit rate</span></div>
      <div class="kpi"><b>${need ? pct(need) : "—"}</b><span>Needed</span></div>
      <div class="kpi ${profit > 0 ? "good" : profit < 0 ? "bad" : ""}"><b>${n ? (profit >= 0 ? "+" : "") + profit.toFixed(1) + "u" : "—"}</b><span>Flat 1u</span></div>`;
    // calibration on everything graded, by the best estimate
    const bins = [[0.5, 0.55], [0.55, 0.6], [0.6, 0.65], [0.65, 0.7], [0.7, 1.01]];
    const calRows = bins.map(([lo, hi]) => { const s = all.filter((r) => r.grade !== "push" && r.p_model != null && r.p_model >= lo && r.p_model < hi); const k = s.filter((r) => r.grade === "won").length; return { lo, hi, n: s.length, rate: s.length ? k / s.length : null, mid: s.length ? s.reduce((a, r) => a + r.p_model, 0) / s.length : (lo + Math.min(hi, 0.75)) / 2 }; });
    $("#cal").innerHTML = all.length ? calRows.map((c) => `<div class="r"><span>${pct(c.lo)}${c.hi > 1 ? "+" : "–" + pct(c.hi)}</span><div class="b2">${c.rate != null ? `<i style="width:${c.rate * 100}%"></i>` : ""}<u style="left:${c.mid * 100}%"></u></div><span>${c.rate != null ? pct(c.rate) + " · " + c.n : "—"}</span></div>`).join("") + `<div class="foot" style="margin:4px 0 0">Bar = actual hit rate · tick = what the board predicted. Bars reaching their tick means the percentages can be trusted.</div>`
      : `<div class="empty" style="padding:14px">Nothing graded yet — results appear the morning after games.</div>`;
    const byDay = {}; pick.forEach((r) => { const d = String(r.commence_time || "").slice(0, 10); (byDay[d] = byDay[d] || []).push(r); });
    const days = Object.keys(byDay).sort().reverse();
    $("#recList").innerHTML = days.length ? days.map((d) => `<div class="dayh">${new Date(d + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</div>` + byDay[d].map((r) => `<div class="res"><span class="mk2 ${r.grade === "won" ? "w" : r.grade === "lost" ? "l" : "p"}">${r.grade === "won" ? "✓" : r.grade === "lost" ? "✗" : "–"}</span>
      <div><b>${esc(r.player_ref)}</b><small>${esc(LABEL[r.market] || r.market)} ${r.side === "over" ? "O" : "U"} ${r.line} · ${esc(bookName(r.book))} · ${pct(r.p_model)}</small></div><div class="act">${r.actual ?? "—"}<small style="display:block;font-size:11px;color:var(--ink-3)">actual</small></div></div>`).join("")).join("")
      : `<div class="empty" style="padding:14px">No graded picks for this filter yet.</div>`;
  }
  $("#recFilters").addEventListener("click", (e) => { const b = e.target.closest("[data-rec]"); if (!b) return; state.recFilter = b.dataset.rec; $$("#recFilters .chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); renderRecord(); });

  // ------------------------------------------------------------------ info sheets
  $("#unval").addEventListener("click", () => openSheet(`<div class="sh-top"><h2>How to read this board</h2><button class="btn small" data-close>Done</button></div>
    <p><b>Unvalidated.</b> These are heuristics, not the finished model. Each is pulled toward the market by how often it has been right, so a pick only clears when it disagrees with the market strongly. Bet small.</p>
    <p><b>★ Favorite</b> = the rule fixed before any results: both projections clear by 3+ points and no injury tag. The Record tab grades it.</p>
    <p><b>The tick</b> on each bar is what the bet must hit to break even: Hard Rock's price, or your pick'em entry's per-pick rate.</p>
    <p><b>Fair</b> is the market's own view with the vig removed (for pick'em, the sportsbooks' price at that line). <b>Form</b> is recent games. <b>Matchup</b> adds opponent, game script and scoring environment. <b>PFF</b> is the unit matchup, graded weekly before it earns a vote.</p>
    <p><b>Gestures:</b> tap a card for the full page · swipe right to add to slip · swipe left to hide.</p>
    <p style="color:var(--ink-3);font-size:12px">Team names, logos and player photos belong to their owners and are shown for reference only.</p>`));
  $("#alertsBtn").addEventListener("click", () => openSheet(`<div class="sh-top"><h2>Phone alerts</h2><button class="btn small" data-close>Done</button></div>
    <p>Archer can ping your phone when a new <b>★ Favorite</b> appears, and when a player on one is ruled <b>OUT</b>. Alerts come through the free <b>ntfy</b> app.</p>
    <ol><li>Install <b>ntfy</b> from the App Store or Google Play.</li>
      <li>On the server, add a long random topic name to <code>.env</code>: <code>NTFY_TOPIC=archer-…</code> (it works like a password — don't share it).</li>
      <li>In the ntfy app tap <b>+</b> and subscribe to that same topic name.</li></ol>
    <p>Alerts then arrive after each board refresh. Tapping one opens this board.</p>`));
  $("#refreshPill").addEventListener("click", () => location.reload());
  $("#reloadBtn").addEventListener("click", () => location.reload());

  // ------------------------------------------------------------------ tabs, league, data
  function show(tab) {
    state.tab = tab;
    $$(".tabbar button").forEach((x) => x.setAttribute("aria-selected", String(x.dataset.tab === tab)));
    for (const v of ["props", "games", "slip", "bets", "record"]) $(`#${v}View`).classList.toggle("hidden", tab !== v);
    $("#leagueSeg").style.visibility = ["props", "games", "record"].includes(tab) ? "visible" : "hidden";
    store.set("archer-tab", tab);
    if (tab === "slip") renderSlip();
    if (tab === "bets") renderBets();
    if (tab === "record") renderRecord();
    window.scrollTo({ top: 0 });
  }
  $(".tabbar").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { closeSheet(); show(b.dataset.tab); } });
  function setLeague(lg) {
    state.league = lg; store.set("archer-league", lg);
    $$("#leagueSeg button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.league === lg)));
    state.f.market = "all"; state.f.book = "all"; saveF();
    renderProps(); renderGames(); if (state.tab === "record") renderRecord();
  }
  $("#leagueSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-league]"); if (b) setLeague(b.dataset.league); });

  const get = (f) => fetch(`./data/${f}?v=${Date.now()}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const assetsReady = get("assets.json").then((a) => { state.assets = a; });
  get("track.json").then((t) => {
    if (!t || !t.weeks || !t.weeks.length) return;
    const f = (x) => (x == null ? "–" : x.toFixed(3));
    $("#record").innerHTML = "<b>Weekly scorer</b> · " + t.weeks.slice(-4).map((w) => `Wk ${w.week}: Brier form ${f((w.brier || {}).form)} / matchup ${f((w.brier || {}).matchup)} / book ${f((w.brier || {}).book)}`).join(" · ") + ` (coin flip ${t.coin_flip_brier.toFixed(3)})`;
    $("#record").classList.remove("hidden");
  });
  Promise.all([get("screen.json"), assetsReady]).then(([data]) => {
    if (!data) { $("#meta").textContent = "No board published yet"; $("#list").innerHTML = `<div class="empty"><b>No board yet</b>It publishes after the next line snapshot.</div>`; renderTops(); return; }
    state.rows = data.rows || []; state.meta = data.meta || {}; state.asOf = state.meta.as_of;
    const h = store.get("archer-hidden", null); if (h && h.asOf === state.asOf) state.hidden = new Set(h.keys || []);
    const d = parseStamp(state.meta.as_of), age = ageText(d), stale = d && Date.now() - d.getTime() > 6 * 3600 * 1000;
    $("#meta").textContent = age ? `Lines ${age} old · tap to refresh` : "Board loaded";
    $("#refreshPill").classList.toggle("stale", !!stale);
    $("#stamp").textContent = `Board ${state.meta.as_of || ""} · exported ${state.meta.exported_at || ""}`;
    renderProps(); if (state.tab === "slip") renderSlip();
  });
  Promise.all([get("games.json"), assetsReady]).then(([g]) => { state.games = g || {}; renderGames(); });
  Promise.all([get("results.json"), get("history.json")]).then(([r, h]) => {
    state.results = r; state.history = h;
    if (r) { state.bets.forEach(settle); saveBets(); if (state.tab === "bets") renderBets(); }
    if (state.tab === "record") renderRecord();
  });
  // a new board lands roughly every 15 minutes on game days: offer it without losing your place
  setInterval(() => { get("meta.json").then((m) => { if (m && state.asOf && m.as_of && m.as_of !== state.asOf) $("#newBoard").classList.remove("hidden"); }); }, 180000);
  // countdowns tick while the app is open
  setInterval(() => { if (state.tab === "props" && !sheetEl) renderTops(); }, 60000);

  $$("#leagueSeg button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.league === state.league)));
  saveSlip();
  const saved = store.get("archer-tab", "props");
  show(["props", "games", "slip", "bets", "record"].includes(saved) ? saved : "props");

  if ("serviceWorker" in navigator) {
    let had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (had) location.reload(); had = true; });
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => {});
  }
})();
