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
  // the player page's large cutout: ESPN's transparent headshot sits on the team colour
  function faceCut(league, name, tid) {
    const f = face(league, name, tid);
    return f && f.length ? `<img class="cut" src="${esc(f[0])}" data-alt="${esc(f[1] || "")}" alt="" referrerpolicy="no-referrer" onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt='';this.style.borderRadius='16px';this.style.height='150px';this.style.bottom='18px';this.style.right='14px'}else{this.remove()}">` : "";
  }
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

  // compact card: ring = best estimate with the break-even tick; dots = which views clear;
  // strip = last five results against this line (green hit, red miss)
  function ring(p, be) {
    const R = 24, C = 2 * Math.PI * R, v = p == null ? 0 : Math.max(0, Math.min(1, p));
    const yes = p != null && p >= be, col = p == null ? "var(--line-2)" : yes ? "var(--accent-2)" : "var(--ink-3)";
    const ta = be * 2 * Math.PI, tx = 29 + Math.cos(ta) * R, ty = 29 + Math.sin(ta) * R, tx2 = 29 + Math.cos(ta) * (R - 7), ty2 = 29 + Math.sin(ta) * (R - 7);
    return `<div class="ring" title="best estimate ${pct(p)} · needs ${pct(be)}"><svg viewBox="0 0 58 58"><circle cx="29" cy="29" r="${R}" fill="none" stroke="var(--track)" stroke-width="6"/>
      <circle class="arc" cx="29" cy="29" r="${R}" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - v)}"/>
      <line x1="${tx}" y1="${ty}" x2="${tx2}" y2="${ty2}" stroke="var(--ink)" stroke-width="2.4" transform="translate(${Math.cos(ta) * 3.5} ${Math.sin(ta) * 3.5})"/></svg>
      <div class="rv"><div>${p == null ? "—" : Math.round(p * 100)}<small>need ${Math.round(be * 100)}</small></div></div></div>`;
  }
  function dots(r, be) {
    const d = (p, cls) => `<i class="${p == null ? "n" : p >= be ? cls : ""}"></i>`;
    return `<div class="dots" title="form · matchup · PFF">${d(r.p_naive, "y")}${d(r.p_matchup, "y")}${d(r.p_pff, "p")}</div>`;
  }
  function spark(r) {
    const g = gameLog(r).slice(0, 5).reverse(); if (!g.length) return "";
    const line = Number(r.line), mx = Math.max(line * 1.5, ...g.map((x) => x.v)) || 1;
    const hits = g.filter((x) => (r.side === "over" ? x.v > line : x.v < line)).length;
    return `<div><div class="spark" aria-label="last ${g.length}: ${hits} hit">${g.map((x) => `<i class="${(r.side === "over" ? x.v > line : x.v < line) ? "y" : ""}" style="height:${Math.max(3, (x.v / mx) * 26)}px"></i>`).join("")}</div><div class="spark-l">${hits}/${g.length} L${g.length}</div></div>`;
  }
  function card(r, i) {
    const lg = leagueOf(r), be = r.breakeven_p ?? 0.524, t = team(lg, r.form_team), over = r.side === "over";
    const w = when(r.commence_time);
    const tags = [
      r.injury_note ? `<span class="tag good">▲ ${esc(String(r.injury_note).split(";")[0])}</span>` : "",
      movement(r),
      r.dfs && r.best_line === false ? '<span class="tag warn">better line elsewhere</span>' : "",
      r.dfs && r.best_line === true && r.other_lines ? '<span class="tag good">best line</span>' : "",
      mktTag(r), chgTags(r),
    ].join("");
    const edge = r.edge == null ? "" : `<span class="edge ${r.edge > 0 ? "pos" : "neg"}">${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(1)}</span>`;
    return `<div class="swipe" data-i="${i}"><div class="under"><span class="l">+ Slip</span><span class="r">Hide</span></div>
      <div class="card v3 ${w.locked ? "locked" : ""}" style="--tc:${esc((t && t.color) || "var(--line-2)")}">
        <div class="row1">${avatar(r.player_ref, lg, r.form_team)}
          <div class="who"><div class="nm">${state.watch.has(normName(r.player_ref)) ? '<span class="star">★</span>' : ""}${esc(r.player_ref)}${r.status === "OUT" ? '<span class="st out">OUT</span>' : r.status === "Q" ? '<span class="st q">Q</span>' : ""}</div>
            <div class="ctx">${ctxLine(r)}</div>
            <div class="pick2" style="margin-top:6px"><span class="mkt">${esc(r.market_label || LABEL[r.market] || r.market)}</span><span class="line" style="font-size:21px"><span class="dir ${over ? "o" : "u"}">${over ? "O" : "U"}</span><span class="num">${r.line}</span></span>${verdictChip(r)}</div>${r.glance_head ? `<div class="gl">${esc(r.glance_head)}</div>` : ""}</div>
          <div style="text-align:center">${ring(r.p_model, be)}${dots(r, be)}</div>
        </div>
        <div class="row2"><div class="subrow" style="margin-top:0">${bookPill(r, be)}${edge}${tags}</div>
          <div style="display:flex;align-items:center;gap:10px">${spark(r)}<button class="quick ${inSlip(r) ? "on" : ""}" data-quick="${i}" aria-label="Add to slip">${inSlip(r) ? "✓" : "+"}</button></div></div>
      </div></div>`;
  }

  function propLeg(r) {
    return {
      id: `p|${r.book || "hardrockbet_fl"}|${r.event_id}|${r.player_ref}|${r.market}|${r.side}|${r.line}`, kind: "prop", league: leagueOf(r),
      label: `${r.player_ref} ${r.market_label || LABEL[r.market] || r.market} ${r.side} ${r.line}`, sub: `${r.away_team || ""} @ ${r.home_team || ""}`,
      name_key: normName(r.player_ref), stat: STAT_OF[r.market] || null, side: r.side, line: r.line, market: r.market, book: r.book,
      price: r.dfs ? null : r.price, p: r.p_model ?? null, event: r.event_id, date: String(r.commence_time || "").slice(0, 10), kick: r.commence_time,
      dfs: !!r.dfs, app: r.dfs ? APP[r.book] || r.book : null, be: r.breakeven_p ?? null, team: r.form_team,
      mean: r.proj_mean ?? r.form_mean ?? null, sd: r.proj_sd ?? r.form_sd ?? null, // sweat mode's pre-game projection
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
    if (state.event) rows = rows.filter((r) => r.event_id === state.event);
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
  function renderSlate() {
    const rows = leagueRows(), live = rows.filter((r) => !when(r.commence_time).locked);
    const evs = {}; live.forEach((r) => { if (!evs[r.event_id]) evs[r.event_id] = r; });
    const games = Object.values(evs).sort((a, b) => String(a.commence_time).localeCompare(String(b.commence_time)));
    if (!rows.length) { $("#slate").innerHTML = ""; return; }
    const first = games[0] && new Date(games[0].commence_time);
    const day = first && !isNaN(first) ? first.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" }) : "Board";
    const favs = live.filter((r) => r.fav).length, both = live.filter((r) => (r.agree_count ?? 0) >= 2).length;
    const lg = state.league, logo = (name) => { const id = teamId(lg, name), t = team(lg, id); return t && t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.remove()">` : `<span class="ab">${esc(abbr(lg, id).slice(0, 4))}</span>`; };
    $("#slate").innerHTML = `<div class="slate"><div class="d">${esc(day)}</div>
      <div class="st2"><span><b>${games.length}</b>games</span><span><b>${favs}</b>favorites</span><span><b>${both}</b>both clear</span><span><b>${live.length}</b>lines</span></div>
      <div class="strip" id="strip">${games.map((g) => `<button class="gpill" data-ev="${esc(g.event_id)}" aria-pressed="${state.event === g.event_id}">${logo(g.away_team)}<span>@</span>${logo(g.home_team)}<span class="t2">${esc(when(g.commence_time).txt)}</span></button>`).join("")}</div></div>`;
  }
  $("#slate").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ev]"); if (!b) return;
    state.event = state.event === b.dataset.ev ? null : b.dataset.ev; buzz(); renderProps();
  });
  function renderProps() {
    renderSlate();
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
    if (state.event) { const r = state.rows.find((x) => x.event_id === state.event); if (r) out.push(["event", `${abbr(leagueOf(r), teamId(leagueOf(r), r.away_team))} @ ${abbr(leagueOf(r), teamId(leagueOf(r), r.home_team))}`]); }
    $("#applied").innerHTML = out.map(([k, t]) => `<button class="chip" aria-pressed="true" data-clear="${k}">${esc(t)} ✕</button>`).join("");
    $("#filterN").textContent = out.length; $("#filterN").classList.toggle("hidden", !out.length);
  }
  $("#applied").addEventListener("click", (e) => {
    const b = e.target.closest("[data-clear]"); if (!b) return;
    if (b.dataset.clear === "event") { state.event = null; renderProps(); return; }
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
    dragToClose(s);
    history.pushState({ sheet: 1 }, "");
    return s;
  }
  // pull a sheet down to dismiss it, from the grab bar or anywhere while it is scrolled to the top.
  // Touch events (not pointer events) so the drag can claim the gesture before iOS scrolls.
  function dragToClose(s) {
    const box = s.querySelector(".in");
    let y0 = null, x0 = 0, dy = 0, t0 = 0, active = false;
    const start = (x, y, target) => {
      if (target.closest("input, select, textarea, .strip, .chips")) return;
      if (!target.closest(".grab") && box.scrollTop > 0) return;
      y0 = y; x0 = x; dy = 0; t0 = Date.now(); active = false;
    };
    const move = (x, y, ev) => {
      if (y0 == null) return;
      const d = y - y0;
      if (!active && (d < -4 || Math.abs(x - x0) > Math.abs(d) + 4)) { y0 = null; return; } // a scroll or a sideways swipe
      dy = Math.max(0, d);
      if (dy > 8) { active = true; if (ev.cancelable) ev.preventDefault(); box.classList.add("dragging"); box.style.transform = `translateY(${dy}px)`; s.style.setProperty("--dim", String(Math.max(0, 1 - dy / 420))); }
    };
    const end = () => {
      if (y0 == null) return;
      y0 = null; box.classList.remove("dragging");
      if (!active) return;
      const fast = dy > 40 && dy / Math.max(1, Date.now() - t0) > 0.5;
      if (dy > 120 || fast) { box.style.transform = "translateY(105%)"; s.style.setProperty("--dim", "0"); setTimeout(() => closeSheet(), 200); }
      else { box.style.transform = ""; s.style.removeProperty("--dim"); }
    };
    box.addEventListener("touchstart", (e) => start(e.touches[0].clientX, e.touches[0].clientY, e.target), { passive: true });
    box.addEventListener("touchmove", (e) => move(e.touches[0].clientX, e.touches[0].clientY, e), { passive: false });
    box.addEventListener("touchend", end); box.addEventListener("touchcancel", end);
    box.addEventListener("mousedown", (e) => { if (e.button === 0 && !e.target.closest("button, a, input, select, textarea")) { start(e.clientX, e.clientY, e.target); if (y0 != null) e.preventDefault(); } });
    box.addEventListener("mousemove", (e) => move(e.clientX, e.clientY, e));
    box.addEventListener("mouseup", end); box.addEventListener("mouseleave", end);
    // a drag must not also count as a tap on whatever it started over
    box.addEventListener("click", (e) => { if (active) { e.stopPropagation(); e.preventDefault(); active = false; } }, true);
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
        <button class="btn small" data-target>🎯 Alert</button><button class="btn small" data-watch>${watched ? "★" : "☆"}</button><button class="btn small" data-share>Share</button></div></div>
      <div class="hero v3" style="--tc:${esc((t && t.color) || "#334155")};--tc2:${esc((t && t.color2) || (t && t.color) || "#334155")}">
        <div class="wm2">${esc(((t && t.abbr) || r.form_team || "").slice(0, 4))}</div>
        ${faceCut(lg, r.player_ref, r.form_team)}
        <div class="txt">${t && t.logo ? `<img class="tlogo" src="${esc(t.logo)}" alt="" onerror="this.remove()">` : ""}<div class="nm2">${esc(r.player_ref)}</div>
          <div class="sub2">${ctxLine(r)}${r.status ? ` · <span class="st ${r.status === "OUT" ? "out" : "q"}">${esc(r.status)}</span>` : ""}</div>
          <div class="subrow">${verdictChip(r)}${movement(r)}</div></div>
      </div>
      <div class="pickband"><div><div class="l1">${esc(r.market_label || LABEL[r.market] || r.market)} · ${esc(bookName(r.book))}</div><div class="l2">${over ? "OVER" : "UNDER"} ${r.line}</div>
          <div style="font-size:12px;color:var(--ink-3)">best estimate ${pct(r.p_model)} · needs ${pct(be)}${r.dfs ? "" : " at " + odds(r.price)}</div>
          ${r.p_market != null && !r.dfs ? `<div style="font-size:12px;color:${r.off_market ? "var(--accent-2)" : "var(--ink-3)"}">market ${pct(r.p_market)} (${esc(r.market_books || "")})${r.off_market ? " · off-market" : ""}</div>` : ""}
          ${state.bank && !r.dfs && stakeFor(r.p_model, r.price) ? `<div style="font-size:12px;font-weight:700;margin-top:2px">Suggested stake $${stakeFor(r.p_model, r.price)}</div>` : ""}</div>
        ${ring(r.p_model, be)}</div>
      ${glancePanel(r)}
      ${ranksPanel(r)}
      ${w.locked ? `<div class="note-card"><b>Game has started.</b> This line is locked; shown for reference.</div>` : ""}
      <div class="panel"><h3><span>Last ${vals.length} games</span><span style="text-transform:none;letter-spacing:0">${vals.filter((v) => (over ? v > r.line : v < r.line)).length} of ${vals.length} ${over ? "over" : "under"}</span></h3>${gameLogChart(glog, Number(r.line), r.side) || '<div class="empty" style="padding:14px">No game log</div>'}${gameLogList(glog, Number(r.line), r.side, lg)}</div>
      ${r.form_sd ? `<div class="panel"><h3><span>Projection range</span><span style="text-transform:none;letter-spacing:0">shaded = your side</span></h3>${curveChart(r.proj_mean ?? r.form_mean, r.proj_sd || r.form_sd, Number(r.line), r.side, marks)}</div>` : ""}
      <div class="panel"><h3><span>Chances</span><span style="text-transform:none;letter-spacing:0">tick = break-even</span></h3>${meters(r, be)}</div>
      ${others.length > 1 || r.ref_book ? `<div class="panel"><h3>Lines across apps</h3><div class="cmp">${cmp}</div></div>` : ""}
      <details class="panel why"><summary><span>Full breakdown</span><span class="chev">›</span></summary><ul class="whys">${(r.why_points || []).map((x) => `<li class="${String(x).startsWith("PFF") ? "pff" : ""}">${esc(x)}</li>`).join("") || `<li>${esc(r.why_long || "—")}</li>`}</ul></details>
      <div class="actions"><button class="btn primary grow" data-add>${inSlip(r) ? "✓ On your slip" : "+ Add to slip"}</button><button class="btn grow" data-track>Track as single</button></div>`, true);
    s.addEventListener("click", (e) => {
      if (e.target.closest("[data-add]")) { toggleLeg(propLeg(r)); e.target.closest("[data-add]").textContent = inSlip(r) ? "✓ On your slip" : "+ Add to slip"; renderProps(); }
      if (e.target.closest("[data-track]")) trackSingle(propLeg(r));
      if (e.target.closest("[data-share]")) shareCard(r);
      if (e.target.closest("[data-target]")) openTarget(r);
      if (e.target.closest("[data-watch]")) {
        const k = normName(r.player_ref); state.watch.has(k) ? state.watch.delete(k) : state.watch.add(k);
        store.set("archer-watch", [...state.watch]); e.target.closest("[data-watch]").textContent = state.watch.has(k) ? "★" : "☆"; buzz(); renderProps();
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
  // scoreboard-style: team colours split across the header, logos, model score in the middle
  function sbSide(league, id, cls) {
    const t = team(league, id), col = (t && t.color) || "#334155";
    const logo = t && t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.remove()">` : `<span class="fb">${esc(abbr(league, id).slice(0, 4))}</span>`;
    return `<div class="side ${cls}" style="background:linear-gradient(${cls === "h" ? "250deg" : "110deg"}, ${esc(col)}, color-mix(in srgb, ${esc(col)} 55%, #070B12))">${logo}<div class="nm3">${esc((t && (t.nick || t.name)) || id)}<small>${esc((t && t.abbr) || (cls === "h" ? "Home" : "Away"))}</small></div></div>`;
  }
  function countdown(iso) { const w = when(iso); return w.txt ? `<span class="cd ${w.cls}">${esc(w.txt)}</span>` : ""; }
  function gameCard(g, league, i) {
    const m = g.model;
    const market = g.spread_line != null ? `${g.spread_line > 0 ? abbr(league, g.home) + " −" + g.spread_line : g.spread_line < 0 ? abbr(league, g.away) + " " + g.spread_line : "Pick"} · O/U ${g.total_line ?? "—"}` : "";
    const nProps = gameRows(g, league).length;
    const hi = m && m.home >= m.away;
    return `<div class="gcard sb" data-g="${i}">
      <div class="sbh">${sbSide(league, g.away, "a")}
        <div class="mid3">${m ? `<div class="sc2"><span class="${hi ? "lo" : ""}" style="margin:0;color:inherit">${fmt1(m.away)}</span><span>–</span><span class="${hi ? "" : "lo"}" style="margin:0;color:inherit">${fmt1(m.home)}</span></div><div class="lbl3">model score</div>` : `<div class="lbl3">no model</div>`}</div>
        ${sbSide(league, g.home, "h")}</div>
      <div class="gbody">
        <div class="gtop">${countdown(g.kickoff_utc)}<span class="mk">${esc(market)}${g.week ? " · Wk " + g.week : ""}</span></div>
        <div style="margin-top:10px">${wpBar(g, league)}</div>${linesGrid(g, league)}
        ${(g.mismatches || []).length ? `<div class="mism"><span class="h">PFF matchups · unvalidated</span>${g.mismatches.slice(0, 2).map((x) => `<div class="i">${esc(x)}</div>`).join("")}</div>` : ""}
        <div class="glink"><span>Matchup page${nProps ? ` · ${nProps} props` : ""}</span><span>›</span></div></div></div>`;
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
  // ADR-0039: the quick read above the detail
  function glancePanel(r) {
    if (!r.glance_head && !(r.glance || []).length) return "";
    return `<div class="panel glance"><div class="gh">${esc(r.glance_head || "")}</div>${(r.glance || []).map((f) => `<div class="gf ${f.good ? "up" : "dn"}"><i>${f.good ? "▲" : "▼"}</i><span>${esc(f.t)}</span></div>`).join("")}</div>`;
  }
  function gameGlance(g, league) {
    const m = g.model; if (!m) return "";
    const H = abbr(league, g.home), A = abbr(league, g.away), mm = m.home - m.away, tot = m.home + m.away;
    const who = (x) => (x >= 0 ? H : A), pts = [];
    const head = `Model: <b>${esc(who(mm))} by ${Math.abs(mm).toFixed(1)}</b>, about ${tot.toFixed(0)} points total.`;
    if (g.spread_line != null) {
      const d = mm - g.spread_line, mk = `${who(g.spread_line)} by ${Math.abs(g.spread_line)}`;
      pts.push(Math.abs(d) < 1.5 ? { good: true, t: `Agrees with the market (${mk})` } : { good: null, t: `Likes ${who(d)} more than the market does (market ${mk}; ${Math.abs(d).toFixed(1)}-pt gap)` });
    }
    if (g.total_line != null) { const d = tot - g.total_line; pts.push(Math.abs(d) < 2 ? { good: true, t: `Total in line with the market (${g.total_line})` } : { good: null, t: `Sees ${d > 0 ? "more" : "fewer"} points than the market's ${g.total_line} (${Math.abs(d).toFixed(1)} pts)` }); }
    const edges = (g.battles || []).filter((b) => b.good_for && b.league).map((b) => ({ b, r: b.value / b.league })).sort((x, y) => Math.abs(y.r - 1) - Math.abs(x.r - 1)).slice(0, 2);
    edges.forEach(({ b, r }) => { const offEdge = b.good_for === "off" ? r > 1 : r < 1; pts.push({ good: null, t: `${abbr(league, offEdge ? b.off : b.def)} edge: ${String(b.label || b.unit).replace(new RegExp(`\\b(${[b.off, b.def].map((x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "g"), (x) => abbr(league, x))}` }); });
    return `<div class="panel glance"><div class="gh">${head}</div>${pts.map((f) => `<div class="gf ${f.good === true ? "up" : "nt"}"><i>${f.good === true ? "✓" : "•"}</i><span>${esc(f.t)}</span></div>`).join("")}<div class="foot" style="margin:6px 0 0">Game scores are information only: the model has no proven edge on spreads or totals.</div></div>`;
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
      ${gameGlance(g, league)}
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
  // fromServer: the list just came from the server, so record it as synced without re-stamping
  function saveBets(fromServer) {
    const prev = store.get("archer-bets-sig", {}), sig = {}, now = new Date().toISOString(), tombs = store.get("archer-bets-tomb", {});
    let changed = false;
    state.bets.forEach((b) => { const h = betSig(b); if (!fromServer && prev[b.id] !== h) { b.updated = now; changed = true; } sig[b.id] = betSig(b); });
    if (!fromServer) Object.keys(prev).forEach((id) => { if (!(id in sig)) { tombs[id] = now; changed = true; } });
    store.set("archer-bets-v1", state.bets); store.set("archer-bets-sig", sig); store.set("archer-bets-tomb", tombs);
    if (changed) queueSync();
  }
  function newBet(legs, stake, mult) {
    const D = mult || legs.reduce((a, l) => a * dec(Number(l.price)), 1);
    return { id: "b" + Date.now() + Math.random().toString(36).slice(2, 6), placed: new Date().toISOString(), stake, legs: legs.map((l) => ({ ...l, result: null })), odds: toAmerican(D), status: "open", manual: false };
  }
  function trackSingle(leg) {
    if (leg.dfs) { if (!state.slip.some((l) => l.id === leg.id)) toggleLeg(leg); toast("Pick'em: build the entry in your slip, then track it with its payout", { label: "View slip", fn: () => { closeSheet(); show("slip"); } }); return; }
    const stake = Math.max(0, Number($("#stake").value) || stakeFor(leg.p, leg.price) || 10);
    if (!limitOk()) return;
    state.bets.unshift(newBet([leg], stake)); saveBets(); renderBets(); buzz(); toast(`Tracking $${stake} on ${leg.label}`);
  }
  $("#trackParlay").addEventListener("click", () => {
    if (!limitOk()) return;
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
    if (!limitOk()) return;
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
    state.bets.forEach(settle); saveBets(); renderBankroll();
    const clv = clvSummary();
    const settled = state.bets.filter((b) => b.status !== "open"), staked = settled.reduce((a, b) => a + b.stake, 0), back = settled.reduce((a, b) => a + payout(b), 0);
    const w = settled.filter((b) => b.status === "won").length, l = settled.filter((b) => b.status === "lost").length, p = settled.length - w - l;
    const openStake = state.bets.filter((b) => b.status === "open").reduce((a, b) => a + b.stake, 0), profit = back - staked, cls = profit > 0 ? "good" : profit < 0 ? "bad" : "";
    $("#betSummary").innerHTML = `<div class="kpi"><b>${w}–${l}${p ? "–" + p : ""}</b><span>Record</span></div>
      <div class="kpi ${cls}"><b data-count="${Math.abs(profit)}" data-pre="${profit >= 0 ? "+$" : "−$"}">$0</b><span>Profit</span></div>
      <div class="kpi ${cls}"><b ${staked ? `data-count="${(profit / staked) * 100}" data-suf="%" data-d="1"` : ""}>${staked ? "0%" : "—"}</b><span>ROI</span></div>
      <div class="kpi"><b data-count="${openStake}" data-pre="$">$0</b><span>Open</span></div>${clv ? `<div class="kpi ${clv.avg >= 0 ? "good" : "bad"}" style="grid-column:1/-1"><b>${clv.avg >= 0 ? "+" : ""}${(clv.avg * 100).toFixed(1)} pts</b><span>CLV · beat the close ${pct(clv.beat)} of ${clv.n}</span></div>` : ""}`;
    countUp($("#betSummary"));
    let list = state.bets;
    if (state.betFilter === "open") list = list.filter((b) => b.status === "open");
    if (state.betFilter === "settled") list = list.filter((b) => b.status !== "open");
    $("#bets").innerHTML = list.length ? list.map((b) => `<div class="bet">
      <div class="top3"><b>${b.legs.length > 1 ? (isEntry(b) ? b.legs.length + "-pick entry" : b.legs.length + "-leg parlay") : esc(b.legs[0].label)}</b><span class="bst ${b.status}">${b.status}</span></div>
      ${b.legs.length > 1 ? `<ul class="whys" style="margin-top:8px">${b.legs.map((x) => `<li>${esc(x.label)} ${x.dfs ? "" : odds(x.price)}${x.result ? " — " + x.result : ""}${clvChip(x)}${postMortem(x)}</li>`).join("")}</ul>` : `<div class="meta2"><span>${esc(b.legs[0].sub || "")}${clvChip(b.legs[0])}</span></div>${postMortem(b.legs[0])}`}
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
  // cumulative flat-1u result, pick by pick in kickoff order, with a day tick under each new date
  function unitsChart(rows) {
    if (rows.length < 2) return `<div class="empty" style="padding:14px">The line appears after a couple of graded picks.</div>`;
    const seq = rows.slice().sort((a, b) => String(a.commence_time).localeCompare(String(b.commence_time)));
    let run = 0; const pts = [0].concat(seq.map((r) => (run += r.grade === "won" ? 1 / (r.breakeven_p || 0.524) - 1 : -1)));
    const W = 340, H = 150, L = 34, R = 8, T = 12, B = 124;
    const lo = Math.min(0, ...pts), hi = Math.max(0, ...pts), span = hi - lo || 1;
    const x = (i) => L + (i / (pts.length - 1)) * (W - L - R), y = (v) => T + ((hi - v) / span) * (B - T);
    const path = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const last = pts[pts.length - 1], col = last >= 0 ? "var(--accent-2)" : "var(--red)";
    const area = `${path}L${x(pts.length - 1).toFixed(1)},${y(0).toFixed(1)}L${x(0).toFixed(1)},${y(0).toFixed(1)}Z`;
    const days = []; seq.forEach((r, i) => { const d = String(r.commence_time || "").slice(0, 10); if (d && (!days.length || days[days.length - 1].d !== d)) days.push({ d, i: i + 1 }); });
    const step = Math.max(1, Math.ceil(days.length / 5));
    const ticks = days.filter((_, k) => k % step === 0).map(({ d, i }) => { const dt = new Date(d + "T12:00:00"); return `<text x="${x(i).toFixed(1)}" y="${B + 16}" text-anchor="middle">${dt.getMonth() + 1}/${dt.getDate()}</text>`; }).join("");
    const fmt = (v) => (v >= 0 ? "+" : "") + v.toFixed(1) + "u";
    return `<svg class="units" viewBox="0 0 ${W} ${H}" role="img" aria-label="Running units ${fmt(last)}">
      <defs><linearGradient id="ug" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
      <line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line-2)" stroke-dasharray="3 4"/>
      <text x="${L - 6}" y="${y(hi) + 4}" text-anchor="end">${fmt(hi)}</text>${lo < 0 ? `<text x="${L - 6}" y="${y(lo) + 4}" text-anchor="end">${fmt(lo)}</text>` : ""}<text x="${L - 6}" y="${y(0) + 4}" text-anchor="end">0</text>
      <path d="${area}" fill="url(#ug)"/><path d="${path}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(pts.length - 1)}" cy="${y(last)}" r="4" fill="${col}"/>${ticks}
    </svg>`;
  }
  function reportCard(all) {
    const by = {};
    all.filter((r) => r.grade !== "push").forEach((r) => { (by[r.market] = by[r.market] || []).push(r); });
    const rows = Object.entries(by).map(([mk, rs]) => {
      const n = rs.length, hit = rs.filter((r) => r.grade === "won").length / n, need = rs.reduce((a, r) => a + (r.breakeven_p ?? 0.524), 0) / n;
      const cl = rs.filter((r) => r.flag_p_book != null && r.p_book != null && Number(r.flag_line) === Number(r.line)).map((r) => r.p_book - r.flag_p_book);
      const clv = cl.length ? cl.reduce((a, x) => a + x, 0) / cl.length : null;
      const badge = n < 30 ? "unproven" : hit < need - 0.03 || (clv != null && clv < -0.01) ? "struggling" : hit >= need && (clv == null || clv >= 0) ? (n >= 150 ? "proven" : "promising") : "unproven";
      return { mk, n, hit, need, clv, badge };
    }).sort((a, b) => b.n - a.n);
    return rows.length ? `<table class="rc"><tr><th>Market</th><th>Picks</th><th>Hit</th><th>Needs</th><th>CLV</th></tr>${rows.map((x) => `<tr><td>${esc(LABEL[x.mk] || x.mk)} <span class="badge ${x.badge}">${x.badge}</span></td><td>${x.n}</td><td style="color:${x.hit >= x.need ? "var(--accent-2)" : "var(--red)"}">${pct(x.hit)}</td><td>${pct(x.need)}</td><td>${x.clv == null ? "—" : (x.clv >= 0 ? "+" : "") + (x.clv * 100).toFixed(1)}</td></tr>`).join("")}</table>
      <div class="foot" style="margin:8px 0 0">Every side the board cleared, graded, last ${(state.history && state.history.days) || 14} days. CLV = how far the fair price moved toward the pick between first flagged and kickoff (points). Badges: unproven under 30 picks; promising = hitting its break-even with non-negative CLV; proven needs 150+. The weekly scorer on the server is the official record.</div>`
      : `<div class="empty" style="padding:14px">Nothing graded yet.</div>`;
  }
  function renderRecord() {
    const all = gradedHistory(), f = state.recFilter;
    $("#card").innerHTML = reportCard(all);
    const pick = all.filter((r) => (f === "fav" ? r.fav : f === "both" ? (r.agree_count ?? 0) >= 2 : (r.agree_count ?? 0) >= 1));
    const dec2 = pick.filter((r) => r.grade !== "push"), w = dec2.filter((r) => r.grade === "won").length, n = dec2.length;
    const need = n ? dec2.reduce((a, r) => a + (r.breakeven_p ?? 0.524), 0) / n : null;
    const profit = dec2.reduce((a, r) => a + (r.grade === "won" ? 1 / (r.breakeven_p || 0.524) - 1 : -1), 0);
    $("#recSub").textContent = state.history ? `last ${state.history.days || 14} days` : "";
    $("#recKpis").innerHTML = `<div class="kpi"><b>${w}–${n - w}</b><span>Record</span></div>
      <div class="kpi ${n && w / n >= (need || 0.524) ? "good" : n ? "bad" : ""}"><b>${n ? pct(w / n) : "—"}</b><span>Hit rate</span></div>
      <div class="kpi"><b>${need ? pct(need) : "—"}</b><span>Needed</span></div>
      <div class="kpi ${profit > 0 ? "good" : profit < 0 ? "bad" : ""}"><b>${n ? (profit >= 0 ? "+" : "") + profit.toFixed(1) + "u" : "—"}</b><span>Flat 1u</span></div>`;
    $("#units").innerHTML = unitsChart(dec2);
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
  $("#alertsBtn").addEventListener("click", () => { const s = openSheet(`<div class="sh-top"><h2>Notifications</h2><button class="btn small" data-close>Done</button></div>
    ${notifSection()}<details class="howto"><summary>Or use the ntfy app</summary>
    <p>Archer can ping your phone when a new <b>★ Favorite</b> appears, and when a player on one is ruled <b>OUT</b>. Alerts come through the free <b>ntfy</b> app.</p>
    <ol><li>Install <b>ntfy</b> from the App Store or Google Play.</li>
      <li>On the server, add a long random topic name to <code>.env</code>: <code>NTFY_TOPIC=archer-…</code> (it works like a password — don't share it).</li>
      <li>In the ntfy app tap <b>+</b> and subscribe to that same topic name.</li></ol>
    <p>Alerts then arrive after each board refresh. Tapping one opens this board.</p></details>`); bindNotif(s); });
  // theme: auto (follow the phone) -> light -> dark
  const THEME_ICON = {
    auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    dark: '<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/>',
  };
  function applyTheme(t) {
    const root = document.documentElement;
    if (t === "auto") delete root.dataset.theme; else root.dataset.theme = t;
    const light = t === "light" || (t === "auto" && matchMedia("(prefers-color-scheme: light)").matches);
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = light ? "#F3F5F9" : "#070B12";
    $("#themeBtn").innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">${THEME_ICON[t]}</svg>`;
    $("#themeBtn").setAttribute("aria-label", `Theme: ${t}`);
  }
  let theme = store.get("archer-theme", "auto");
  applyTheme(theme);
  $("#themeBtn").addEventListener("click", () => {
    theme = { auto: "light", light: "dark", dark: "auto" }[theme] || "auto";
    store.set("archer-theme", theme); applyTheme(theme); buzz();
    toast(theme === "auto" ? "Theme follows your phone" : `${theme[0].toUpperCase()}${theme.slice(1)} theme`);
  });
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => { if (theme === "auto") applyTheme("auto"); });
  $("#refreshPill").addEventListener("click", () => refresh().then((c) => toast(c ? "New board loaded" : "Already up to date")));
  $("#reloadBtn").addEventListener("click", () => refresh());

  // ------------------------------------------------------------------ phone API (ADR-0037)
  // The server is optional: without it the board works as before. Pairing trades the 6-digit
  // code from `fm api pair` for the passcode, kept on this phone only.
  state.api = store.get("archer-api", null);
  state.chat = store.get("archer-chat", []);
  const apiUrl = () => (state.api && state.api.url) || (state.meta && state.meta.api_url) || "";
  async function apiPost(path, body, timeout = 30000) {
    if (!state.api || !state.api.token) throw new Error("not-connected");
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(state.api.url + path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + state.api.token }, body: JSON.stringify(body || {}), signal: ctl.signal });
      if (r.status === 401) { state.api = null; store.set("archer-api", null); throw new Error("not-connected"); }
      const data = await r.json().catch(() => ({}));
      if (!r.ok && !data.answer) throw new Error(data.error || `HTTP ${r.status}`);
      return data;
    } catch (e) { throw e.name === "AbortError" ? new Error("timed out") : e; } finally { clearTimeout(t); }
  }
  const copy = (text, what) => { try { navigator.clipboard.writeText(text).then(() => toast(`${what} copied`)); } catch (_) { toast("Copy not available"); } };
  function connectHtml(why) {
    return `<div class="pair"><p>${why} Connect this phone to your Archer server once: on the server run <code>uv run fm api pair</code>, then type the code.</p>
      <div class="field">Server<input class="inp" id="pairUrl" value="${esc(apiUrl())}" placeholder="https://…sslip.io" autocapitalize="off" autocorrect="off" spellcheck="false"></div>
      <div class="field">6-digit code<input class="inp code" id="pairCode" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000000"></div>
      <button class="btn primary" id="pairGo" style="width:100%">Connect</button><div class="foot" id="pairMsg" style="margin:10px 0 0"></div></div>`;
  }
  function bindConnect(root, done) {
    const go = async () => {
      const url = $("#pairUrl", root).value.trim().replace(/\/+$/, ""), code = $("#pairCode", root).value.replace(/\D/g, "");
      const msg = $("#pairMsg", root);
      if (!/^https:\/\//.test(url)) { msg.textContent = "The server address starts with https://"; return; }
      if (code.length !== 6) { msg.textContent = "Type the 6 digits from `fm api pair`."; return; }
      msg.textContent = "Connecting…";
      try {
        const r = await fetch(url + "/api/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.token) { msg.textContent = d.error ? `${d.error}${d.tries_left != null ? ` (${d.tries_left} tries left)` : ""}` : `Server said ${r.status}`; return; }
        state.api = { url, token: d.token }; store.set("archer-api", state.api); buzz(); toast("Connected to your server"); syncBets(); loadTargets(); done();
      } catch (_) { msg.textContent = "Couldn't reach that address. Is the server set up (scripts/setup_api.sh)?"; }
    };
    $("#pairGo", root).addEventListener("click", go);
    $("#pairCode", root).addEventListener("input", (e) => { if (e.target.value.replace(/\D/g, "").length === 6) go(); });
  }

  // ---- Ask Archer
  function md(text) { // **bold** and "- " bullets only; everything escaped first
    const inl = (x) => x.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    let html = "", list = false;
    for (const raw of esc(text).split("\n")) {
      const m = raw.match(/^\s*[-•*]\s+(.*)$/);
      if (m) { if (!list) { html += "<ul>"; list = true; } html += `<li>${inl(m[1])}</li>`; continue; }
      if (list) { html += "</ul>"; list = false; }
      if (raw.trim()) html += `<p>${inl(raw)}</p>`;
    }
    return html + (list ? "</ul>" : "");
  }
  function suggestions() {
    const lg = state.league === "cfb" ? "college" : "NFL", out = [`Best 3-pick on PrizePicks for ${lg} right now`, `Strongest unders on the ${lg} board`, "Who gains volume from injuries this week?"];
    if (state.slip.length) out.unshift("Is my slip any good? What would you swap?");
    return out;
  }
  function openAsk(prefill) {
    const s = openSheet(`<div class="sh-top"><h2>Ask Archer</h2><div class="r"><button class="btn small ghost" id="chatNew">New</button><button class="btn small" data-close>Done</button></div></div><div id="askBody"></div>`, true);
    $("#chatNew", s).addEventListener("click", () => { state.chat = []; store.set("archer-chat", []); renderAsk(s); });
    renderAsk(s, prefill);
  }
  function renderAsk(s, prefill) {
    const body = $("#askBody", s);
    if (!state.api) { body.innerHTML = connectHtml("Ask Archer answers questions about the board using Claude."); bindConnect(body, () => renderAsk(s, prefill)); return; }
    const msgs = state.chat.map((m) => `<div class="msg ${m.role === "user" ? "u" : "a"}">${m.role === "user" ? esc(m.text) : md(m.text)}${m.meta ? `<span class="mt">${esc(m.meta)}</span>` : ""}</div>`).join("");
    body.innerHTML = `<div class="chat" id="chat">${state.chat.length ? msgs : `<div class="note-card">Ask about tonight's board in plain English. Archer looks things up on the board and answers with its numbers — Claude Opus 5, a few cents a question, capped monthly on the server.</div>`}
      ${state.chat.length ? "" : `<div class="sugg">${suggestions().map((q) => `<button data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>`}</div>
      <form class="composer" id="askForm"><textarea id="askIn" rows="1" placeholder="Ask about the board…" enterkeyhint="send">${esc(prefill || "")}</textarea><button class="btn primary" aria-label="Send">↑</button></form>`;
    const inp = $("#askIn", body), form = $("#askForm", body);
    const grow = () => { inp.style.height = "auto"; inp.style.height = Math.min(120, inp.scrollHeight) + "px"; };
    inp.addEventListener("input", grow);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
    form.addEventListener("submit", (e) => { e.preventDefault(); const q = inp.value.trim(); if (q) sendAsk(s, q); });
    $$("[data-q]", body).forEach((b) => b.addEventListener("click", () => sendAsk(s, b.dataset.q)));
    const sc = $(".in", s); sc.scrollTop = sc.scrollHeight;
  }
  let asking = false;
  async function sendAsk(s, q) {
    if (asking) return; asking = true;
    const history = state.chat.slice(-8).map((m) => ({ role: m.role, text: m.text }));
    state.chat.push({ role: "user", text: q }); renderAsk(s);
    $("#chat", s).insertAdjacentHTML("beforeend", `<div class="msg a" id="typing"><span class="typing"><i></i><i></i><i></i></span></div>`);
    const sc = $(".in", s); sc.scrollTop = sc.scrollHeight;
    try {
      const d = await apiPost("/api/ask", { question: q, history, league: state.league, slip: state.slip.map((l) => ({ label: `${l.label}${l.app ? " (" + l.app + ")" : ""}` })) }, 150000);
      const meta = d.cost_usd != null ? `Opus 5 · ${(d.cost_usd * 100).toFixed(1)}¢ · $${(d.month_usd ?? 0).toFixed(2)} of $${(d.cap_usd ?? 0).toFixed(0)} this month` : "";
      state.chat.push({ role: "assistant", text: d.answer || "No answer.", meta });
    } catch (e) {
      state.chat.push({ role: "assistant", text: e.message === "not-connected" ? "The server passcode was rejected; connect again." : `Couldn't get an answer (${e.message}).` });
    }
    state.chat = state.chat.slice(-30); store.set("archer-chat", state.chat); asking = false;
    if (sheetEl === s) renderAsk(s);
  }
  $("#askBtn").addEventListener("click", () => { buzz(); openAsk(); });

  // ---- slip check
  const rowFor = (x) => state.rows.find((r) => r.player_ref === x.player && r.market === x.market && r.side === x.side && Number(r.line) === Number(x.board_line ?? x.line) && (!x.book || r.book === x.book));
  function openCheck() {
    const s = openSheet(`<div class="sh-top"><h2>Check a slip</h2><button class="btn small" data-close>Done</button></div><div id="ckBody"></div>`);
    renderCheck(s);
  }
  function shortcutHelp() {
    const url = state.api ? state.api.url : apiUrl();
    return `<details class="howto"><summary>Set up one-tap checking from a screenshot</summary><ol>
      <li>Open <b>Shortcuts</b> → <b>+</b>, name it <b>Archer check</b>. Tap ⓘ, turn on <b>Show in Share Sheet</b>, and accept <b>Images</b>.</li>
      <li>Add <b>Extract Text from Image</b> (input: Shortcut Input).</li>
      <li>Add <b>Get Contents of URL</b>: URL <code>${esc(url)}/api/check?format=text</code> <button class="btn small" data-copy="url">Copy</button>; Method <b>POST</b>; add header <b>Authorization</b> = <code>Bearer ••••</code> <button class="btn small" data-copy="auth">Copy</button>; Request Body <b>JSON</b> with key <b>text</b> = <i>Extracted Text</i>.</li>
      <li>Add <b>Show Result</b>.</li></ol>
      <p style="font-size:13px;color:var(--ink-3)">Then: screenshot your PrizePicks / Underdog / Hard Rock slip → tap the preview → Share → <b>Archer check</b>. The answer pops up without leaving the app. The passcode works like a password — keep the shortcut to yourself.</p></details>`;
  }
  function renderCheck(s, res, text) {
    const body = $("#ckBody", s);
    if (!state.api) { body.innerHTML = connectHtml("Slip check reads a screenshot's text and prices it against the board."); bindConnect(body, () => renderCheck(s)); return; }
    body.innerHTML = `<p style="margin-top:0;color:var(--ink-2);font-size:14px">Open your screenshot, press and hold on the text, <b>Select All</b>, <b>Copy</b>, then paste here.</p>
      <textarea class="inp" id="ckText" style="height:120px;padding:10px;resize:vertical" placeholder="Paste the slip text…">${esc(text || "")}</textarea>
      <div class="actions" style="margin-top:10px"><button class="btn" id="ckPaste">Paste</button><button class="btn primary grow" id="ckGo">Check it</button></div>
      <div id="ckRes" style="margin-top:14px">${res ? checkResult(res) : ""}</div>${shortcutHelp()}`;
    $("#ckPaste", body).addEventListener("click", async () => { try { $("#ckText", body).value = await navigator.clipboard.readText(); } catch (_) { toast("Long-press the box and tap Paste"); } });
    $("#ckGo", body).addEventListener("click", async () => {
      const t = $("#ckText", body).value.trim(); if (!t) { toast("Paste the slip text first"); return; }
      $("#ckRes", body).innerHTML = `<div class="empty" style="padding:18px"><span class="typing"><i></i><i></i><i></i></span></div>`;
      try { const r = await apiPost("/api/check", { text: t }); state.check = r; renderCheck(s, r, t); }
      catch (e) { $("#ckRes", body).innerHTML = `<div class="note-card">Couldn't check it (${esc(e.message)}).</div>`; }
    });
    body.addEventListener("click", (e) => {
      const c = e.target.closest("[data-copy]"); if (c) { copy(c.dataset.copy === "url" ? `${state.api.url}/api/check?format=text` : `Bearer ${state.api.token}`, c.dataset.copy === "url" ? "Address" : "Passcode"); return; }
      const a = e.target.closest("[data-ckadd]"); if (!a || !state.check) return;
      const k = a.dataset.ckadd, list = k === "all" ? state.check.legs : k.startsWith("s") ? [state.check.swaps[Number(k.slice(1))]] : [state.check.legs[Number(k)]];
      let n = 0; list.forEach((x) => { const r = x && rowFor(x); if (r && !inSlip(r)) { state.slip.push(propLeg(r)); n++; } });
      saveSlip(); renderSlip(); renderProps(); toast(n ? `Added ${n} to your slip` : "Nothing new to add");
    });
  }
  function checkResult(r) {
    if (!r.legs.length) return `<div class="note-card">No board players found in that text. Copy the entry screen with names, lines and More/Less showing.</div>`;
    const e = r.entry, sd = (x) => (x === "over" ? "O" : x === "under" ? "U" : "?");
    const head = e ? `<div class="ck-head"><span>${esc(r.app_name || "Entry")} · ${r.legs.length} picks</span><b>${pct(e.p_all, 1)}</b></div><div class="foot" style="margin:0 0 6px">chance all hit (legs treated as independent${e.same_game ? "; two share a game, so it's rougher" : ""})</div>
      ${e.options.map((o) => `<div class="ck-opt"><span>${o.kind} · pays ${o.pays}x</span><span class="${o.ev >= 0 ? "pos" : "neg"}">${o.ev >= 0 ? "+" : ""}${(o.ev * 100).toFixed(0)}% expected</span></div>`).join("")}` : `<div class="ck-head"><span>${esc(r.app_name || "Slip")} · ${r.legs.length} found</span></div>`;
    const legs = r.legs.map((l, i) => `<div class="ck-leg"><span class="mk2 ${l.p == null ? "p" : l.clears ? "w" : "l"}">${l.p == null ? "?" : l.clears ? "✓" : "✗"}</span>
      <div><b>${esc(l.player)}</b> ${sd(l.side)} ${l.line ?? l.board_line ?? "?"} ${esc(l.market_label || "")}<small>${l.p != null ? `best estimate ${pct(l.p)} · needs ${pct(l.be)}${l.fav ? " · ★ favorite" : ""}` : "not priced"}</small>${l.notes.length ? `<small class="n">${esc(l.notes.join(" · "))}</small>` : ""}</div>
      ${rowFor(l) ? `<button class="btn small" data-ckadd="${i}">+</button>` : "<span></span>"}</div>`).join("");
    const sw = r.swaps.length ? `<h3 style="margin-top:14px">Swap out ${esc(r.weakest)} for</h3>${r.swaps.map((x, i) => `<div class="ck-leg"><span>${x.fav ? "★" : ""}</span><div><b>${esc(x.player)}</b> ${sd(x.side)} ${x.line} ${esc(x.market_label || "")}<small>${pct(x.p)}${x.same_game ? " · same game as another pick" : " · different game"}</small></div>${rowFor(x) ? `<button class="btn small" data-ckadd="s${i}">+</button>` : "<span></span>"}</div>`).join("")}` : "";
    return `<div class="panel">${head}${legs}${sw}<div class="actions" style="margin-top:10px"><button class="btn small" data-ckadd="all">Add all to my slip</button></div><div class="foot" style="margin:8px 0 0">Unvalidated heuristics — bet small.</div></div>`;
  }
  $("#checkBtn").addEventListener("click", openCheck);

  // ---- sweat mode: open bets' games, live
  const normCdf = (z) => { const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2); return z >= 0 ? (1 + y) / 2 : (1 - y) / 2; };
  const invNorm = (p) => { p = Math.min(0.999, Math.max(0.001, p)); let lo = -5, hi = 5; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (normCdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
  const teamKey = (x) => String(x || "").toLowerCase().replace(/[^a-z]/g, "");
  const liveWindow = (l) => { const k = Date.parse(l.kick || ""); return l.kind === "prop" && k && Date.now() >= k - 5 * 60000 && Date.now() <= k + 5 * 3600000; };
  function liveBets() { return state.bets.filter((b) => b.status === "open" && b.legs.some(liveWindow)); }
  function legGame(l) {
    const box = state.live && state.live[l.league]; if (!box) return null;
    const [away, home] = String(l.sub || "").split(" @ ").map(teamKey);
    return box.games.find((g) => teamKey(g.away) === away && teamKey(g.home) === home) || null;
  }
  function legNow(l) {
    const g = legGame(l); if (!g) return null;
    const box = state.live[l.league], pl = box.players[l.name_key], stat = l.market === "player_anytime_td" ? "td" : l.stat;
    const cur = pl && pl.stats[stat] != null ? pl.stats[stat] : g.state === "pre" ? null : 0, f = g.remaining ?? 1;
    let chance = null;
    if (cur != null && stat) {
      if (stat === "td") chance = cur >= 1 ? 1 : f <= 0 ? 0 : 1 - Math.pow(1 - (l.p ?? 0.3), f);
      else if (f <= 0 || (l.side === "over" && cur > l.line)) chance = (l.side === "over" ? cur > l.line : cur < l.line) ? 1 : 0;
      else if (l.side === "under" && cur >= l.line) chance = 0;
      else {
        let sd = l.sd || Math.max(1, 0.45 * l.line), mean = l.mean;
        if (mean == null) { const z = invNorm(l.p ?? 0.5); mean = l.side === "over" ? l.line + sd * z : l.line - sd * z; }
        const mu = cur + mean * f, s2 = Math.max(0.5, sd * Math.sqrt(f)), over = 1 - normCdf((l.line - mu) / s2);
        chance = l.side === "over" ? over : 1 - over;
      }
    } else if (g.state === "pre") chance = l.p ?? null;
    return { g, cur, chance };
  }
  function renderLive() {
    const bets = liveBets(), el = $("#live");
    $('.tabbar [data-tab="bets"]').classList.toggle("live", bets.length > 0);
    if (!el) return;
    if (!bets.length) { el.innerHTML = ""; return; }
    if (!state.api) { el.innerHTML = `<div class="panel live"><h3><span><i class="dot2"></i>Live</span></h3><p style="margin:0 0 10px;font-size:14px">${bets.length} open bet${bets.length > 1 ? "s are" : " is"} in play. Connect your server to sweat them here with live stats.</p><button class="btn small" id="liveConnect">Connect</button></div>`; $("#liveConnect").addEventListener("click", () => { const s = openSheet(`<div class="sh-top"><h2>Connect</h2><button class="btn small" data-close>Done</button></div><div id="cb"></div>`); $("#cb", s).innerHTML = connectHtml(""); bindConnect($("#cb", s), () => { closeSheet(); pollLive(); }); }); return; }
    const age = state.live && state.live.at ? Math.round((Date.now() - state.live.at) / 1000) : null;
    el.innerHTML = `<div class="panel live"><h3><span><i class="dot2"></i>Live</span><span style="text-transform:none;letter-spacing:0">${age == null ? "loading…" : age < 10 ? "just updated" : `updated ${age}s ago`}</span></h3>${bets.map((b) => {
      const rows = b.legs.map((l) => ({ l, n: legNow(l) })), known = rows.every((x) => x.n && x.n.chance != null);
      const all = known ? rows.reduce((a, x) => a * x.n.chance, 1) : null;
      return `<div class="lvbet"><div class="lvh"><b>${b.legs.length > 1 ? (isEntry(b) ? b.legs.length + "-pick entry" : b.legs.length + "-leg parlay") : esc(b.legs[0].label)}</b><span class="lvp" style="color:${all == null ? "inherit" : all >= 0.5 ? "var(--accent-2)" : all >= 0.2 ? "var(--amber)" : "var(--red)"}">${all == null ? "—" : pct(all)}</span></div>${rows.map(({ l, n }) => {
        const cur = n && n.cur != null ? n.cur : null, mx = Math.max(l.line * 1.35, cur || 0, 1), c = n ? n.chance : null;
        const cls = c == null ? "" : c >= 0.5 ? "" : c >= 0.2 ? "warn" : "bad";
        return `<div class="lvleg"><div class="nm">${esc(l.label)}<span>${n && n.g ? esc(n.g.state === "pre" ? "not started" : n.g.detail) : "no live data"}</span></div>
          <div class="lvbar"><i class="${cls}" style="width:${cur == null ? 0 : Math.min(100, (cur / mx) * 100)}%"></i><u style="left:${(l.line / mx) * 100}%"></u></div>
          <div class="st"><span>${cur == null ? "—" : cur} / ${l.line}</span><span>${c == null ? "" : c >= 1 ? "✓ hit" : c <= 0 ? "✗ dead" : pct(c) + " to hit"}</span></div></div>`;
      }).join("")}</div>`;
    }).join("")}<div class="foot" style="margin:6px 0 0">Live chance = stats so far plus the pre-game projection for the time left. Rough; independent legs.</div></div>`;
  }
  let polling = false;
  async function pollLive() {
    const bets = liveBets(); renderLive();
    if (!bets.length || !state.api || document.hidden || polling) return;
    polling = true;
    try {
      const by = {};
      bets.forEach((b) => b.legs.filter(liveWindow).forEach((l) => { const [away, home] = String(l.sub || "").split(" @ "); if (away && home) (by[l.league] = by[l.league] || new Map()).set(away + "|" + home, { away, home }); }));
      const live = { at: Date.now() };
      for (const [lg, games] of Object.entries(by)) live[lg] = await apiPost("/api/live", { league: lg, games: [...games.values()] }, 25000);
      state.live = live;
    } catch (_) { /* keep the last numbers; the next poll retries */ }
    polling = false; renderLive();
  }
  setInterval(pollLive, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) pollLive(); });

  // ------------------------------------------------------------------ ADR-0038
  // ---- change tracking: what moved since you last looked
  const sigOf = (r) => [r.line, r.dfs ? null : r.price, r.fav ? 1 : 0, r.status || "", r.off_market ? 1 : 0];
  state.changes = new Map(); state.newCount = 0;
  function computeChanges() {
    const base = store.get("archer-seen", null), cur = {};
    state.rows.forEach((r) => { cur[rowKey(r)] = sigOf(r); });
    state.changes = new Map(); state.newCount = 0;
    if (!base || !base.sig) { store.set("archer-seen", { at: Date.now(), sig: cur }); return; }
    state.seenAt = base.at;
    for (const r of state.rows) {
      const was = base.sig[rowKey(r)], now = cur[rowKey(r)];
      if (!was) { state.newCount++; continue; }
      const tags = [];
      if (was[0] !== now[0]) tags.push({ c: (r.side === "over") === (now[0] < was[0]) ? "good" : "", t: `line ${was[0]} → ${now[0]}` });
      if (now[1] != null && was[1] != null && Math.abs(implied(now[1]) - implied(was[1])) >= 0.02) tags.push({ c: now[1] > was[1] ? "good" : "", t: `${odds(was[1])} → ${odds(now[1])}` });
      if (now[2] && !was[2]) tags.push({ c: "fav", t: "new ★" });
      if (!now[2] && was[2]) tags.push({ c: "", t: "no longer ★" });
      if (now[3] !== was[3] && now[3]) tags.push({ c: "out", t: now[3] });
      if (now[4] && !was[4]) tags.push({ c: "good", t: "off-market" });
      if (tags.length) state.changes.set(rowKey(r), tags);
    }
  }
  let seenTimer = null;
  function markSeen() { const cur = {}; state.rows.forEach((r) => { cur[rowKey(r)] = sigOf(r); }); store.set("archer-seen", { at: Date.now(), sig: cur }); }
  const chgTags = (r) => (state.changes.get(rowKey(r)) || []).map((t) => `<span class="chg ${t.c}">${esc(t.t)}</span>`).join("");
  const mktTag = (r) => (r.off_market && !r.dfs ? `<span class="tag mkt">Off-market +${(r.market_edge * 100).toFixed(1)}</span>` : "");

  // ---- bankroll: stake guide and a daily loss limit
  state.bank = store.get("archer-bank", null); // {roll, maxPct, kelly, limit}
  function stakeFor(p, price) {
    const b = state.bank; if (!b || !b.roll || p == null || price == null) return null;
    const d = dec(Number(price)), k = (p * d - 1) / (d - 1);
    if (k <= 0) return 0;
    return Math.max(1, Math.round(b.roll * Math.min((b.maxPct || 1) / 100, (b.kelly || 0.25) * k)));
  }
  const localDay = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString(); };
  function todayMoney() {
    const t = new Date().toLocaleDateString(), mine = state.bets.filter((b) => localDay(b.placed) === t);
    const settled = mine.filter((b) => b.status !== "open"), pl = settled.reduce((a, b) => a + payout(b) - b.stake, 0);
    return { pl, open: mine.filter((b) => b.status === "open").reduce((a, b) => a + b.stake, 0), n: mine.length };
  }
  const overLimit = () => { const b = state.bank; if (!b || !b.limit) return false; const m = todayMoney(); return -m.pl - m.open >= b.limit; };
  function limitOk() { return !overLimit() || confirm("You're at today's loss limit (settled losses plus money already in play). Track this anyway?"); }
  function renderBankroll() {
    const el = $("#bankroll"); if (!el) return;
    const b = state.bank, m = todayMoney();
    el.innerHTML = b && b.roll ? `${overLimit() ? `<div class="warnbar">Today's loss limit is reached. Stepping away is the +EV move.</div>` : ""}<div class="panel"><h3><span>Bankroll</span><button class="btn small ghost" id="bankEdit" style="min-height:26px">Edit</button></h3>
        <dl class="calc" style="margin:0"><dt>Bankroll</dt><dd>$${b.roll.toFixed(0)}</dd><dt>Today</dt><dd style="color:${m.pl >= 0 ? "var(--accent-2)" : "var(--red)"}">${m.pl >= 0 ? "+" : "−"}$${Math.abs(m.pl).toFixed(2)} · $${m.open.toFixed(0)} in play</dd>${b.limit ? `<dt>Daily loss limit</dt><dd>$${b.limit}</dd>` : ""}<dt>Max per bet</dt><dd>${b.maxPct}% ($${(b.roll * b.maxPct / 100).toFixed(0)})</dd></dl></div>`
      : `<button class="btn small" id="bankEdit" style="margin-bottom:12px">Set a bankroll for stake suggestions</button>`;
    $("#bankEdit").addEventListener("click", editBank);
  }
  function editBank() {
    const b = state.bank || { roll: 500, maxPct: 1, kelly: 0.25, limit: 50 };
    const s = openSheet(`<div class="sh-top"><h2>Bankroll</h2><button class="btn small" data-close>Done</button></div>
      <p style="color:var(--ink-2);font-size:14px;margin-top:0">Stakes are suggested from each pick's edge (a quarter of the Kelly stake) and capped per bet. While the board is unvalidated, keep the cap small.</p>
      <div class="field">Bankroll ($)<input class="inp" id="bkRoll" inputmode="decimal" value="${b.roll}"></div>
      <div class="field">Max per bet (% of bankroll)<input class="inp" id="bkMax" inputmode="decimal" value="${b.maxPct}"></div>
      <div class="field">Daily loss limit ($, blank for none)<input class="inp" id="bkLim" inputmode="decimal" value="${b.limit ?? ""}"></div>
      <div class="actions"><button class="btn primary grow" id="bkSave">Save</button>${state.bank ? '<button class="btn danger" id="bkOff">Turn off</button>' : ""}</div>`);
    $("#bkSave", s).addEventListener("click", () => {
      const roll = Number($("#bkRoll", s).value), maxPct = Math.min(10, Math.max(0.1, Number($("#bkMax", s).value) || 1)), limit = Number($("#bkLim", s).value) || null;
      if (!(roll > 0)) { toast("Enter a bankroll"); return; }
      state.bank = { roll, maxPct, kelly: 0.25, limit }; store.set("archer-bank", state.bank); closeSheet(); renderBankroll(); renderToday(); toast("Bankroll saved");
    });
    const off = $("#bkOff", s); if (off) off.addEventListener("click", () => { state.bank = null; store.set("archer-bank", null); closeSheet(); renderBankroll(); renderToday(); });
  }

  // ---- bets on the server: sync, CLV, logging from a screenshot
  const hashStr = (x) => { let h = 5381; for (let i = 0; i < x.length; i++) h = ((h << 5) + h + x.charCodeAt(i)) | 0; return h; };
  const betSig = (b) => { const { updated, ...rest } = b; return hashStr(JSON.stringify(rest)); };
  let syncT = null;
  const queueSync = () => { clearTimeout(syncT); syncT = setTimeout(syncBets, 1500); };
  async function syncBets() {
    if (!state.api) return;
    const tombs = store.get("archer-bets-tomb", {});
    try {
      const d = await apiPost("/api/bets/sync", { bets: state.bets, deleted: Object.entries(tombs).map(([id, updated]) => ({ id, updated })) });
      const gone = new Set(d.deleted || []);
      state.bets = (d.bets || []).filter((b) => !gone.has(b.id)).sort((a, b) => String(b.placed).localeCompare(String(a.placed)));
      store.set("archer-bets-tomb", {}); saveBets(true);
      if (state.tab === "bets") renderBets(); renderLive(); if (state.tab === "today") renderToday();
    } catch (_) { /* offline or not connected: the phone copy stays the record */ }
  }
  const clvChip = (l) => (l.clv != null ? `<span class="clv ${l.clv >= 0 ? "pos" : "neg"}" title="closing-line value">CLV ${l.clv >= 0 ? "+" : ""}${(l.clv * 100).toFixed(1)}</span>` : l.clv_line ? `<span class="clv ${l.clv_line > 0 ? "pos" : "neg"}">line ${l.clv_line > 0 ? "+" : ""}${l.clv_line}</span>` : "");
  function resultRow(l) {
    const res = state.results; if (!res || !l.date) return null;
    return res.players.find((p) => p.league === l.league && p.name_key === l.name_key && dayDiff(p.date, l.date) <= 1) || null;
  }
  function postMortem(l) {
    if (!l.result || !["won", "lost"].includes(l.result)) return "";
    const row = resultRow(l), v = row && l.stat ? row.stats[l.stat] : null; if (v == null) return "";
    const proj = l.mean != null ? ` vs ${Number(l.mean).toFixed(1)} projected (${v - l.mean >= 0 ? "+" : ""}${(v - l.mean).toFixed(1)})` : "";
    const use = l.stat === "rush_yds" && row.stats.rush_att != null ? ` on ${row.stats.rush_att} carries` : l.stat === "rec_yds" && row.stats.rec != null ? ` on ${row.stats.rec} catches` : "";
    return `<span class="pm">${l.result === "won" ? "✓" : "✗"} ${v}${use}${proj}</span>`;
  }
  function clvSummary() {
    const legs = state.bets.flatMap((b) => b.legs).filter((l) => l.clv != null);
    if (!legs.length) return null;
    return { n: legs.length, beat: legs.filter((l) => l.clv > 0).length / legs.length, avg: legs.reduce((a, l) => a + l.clv, 0) / legs.length };
  }
  function openLog() {
    const s = openSheet(`<div class="sh-top"><h2>Log a bet</h2><button class="btn small" data-close>Done</button></div><div id="lgBody"></div>`);
    const body = $("#lgBody", s);
    if (!state.api) { body.innerHTML = connectHtml("Logging from a screenshot runs on your server."); bindConnect(body, () => { closeSheet(); openLog(); }); return; }
    const url = `${state.api.url}/api/bets/log?format=text`;
    body.innerHTML = `<p style="margin-top:0;color:var(--ink-2);font-size:14px">Open the screenshot of your placed bet, press and hold the text, <b>Select All</b>, <b>Copy</b>, then paste.</p>
      <textarea class="inp" id="lgText" style="height:120px;padding:10px" placeholder="Paste the bet receipt text…"></textarea>
      <div class="actions" style="margin-top:10px"><button class="btn" id="lgPaste">Paste</button><button class="btn primary grow" id="lgGo">Log it</button></div><div id="lgRes" style="margin-top:12px"></div>
      <details class="howto"><summary>One tap from Hard Rock: the “Archer log” Shortcut</summary><ol>
        <li>In <b>Shortcuts</b>, duplicate <b>Archer check</b> and name it <b>Archer log</b>.</li>
        <li>Change the URL to <code>${esc(url)}</code> <button class="btn small" data-copy2>Copy</button>. Everything else stays the same.</li></ol>
        <p style="font-size:13px;color:var(--ink-3)">After you place a bet: screenshot the confirmation → Share → <b>Archer log</b>. It lands in your Bets tab, gets graded, shows closing-line value after kickoff, and you get live notifications during the game.</p></details>`;
    $("[data-copy2]", body).addEventListener("click", () => copy(url, "Address"));
    $("#lgPaste", body).addEventListener("click", async () => { try { $("#lgText", body).value = await navigator.clipboard.readText(); } catch (_) { toast("Long-press the box and tap Paste"); } });
    $("#lgGo", body).addEventListener("click", async () => {
      const t = $("#lgText", body).value.trim(); if (!t) return;
      try { const d = await apiPost("/api/bets/log", { text: t }); $("#lgRes", body).innerHTML = `<div class="note-card" style="white-space:pre-line">${esc(d.text)}</div>`; if (d.bet) { buzz(); syncBets(); } }
      catch (e) { $("#lgRes", body).innerHTML = `<div class="note-card">Couldn't log it (${esc(e.message)}).</div>`; }
    });
  }
  $("#logBtn").addEventListener("click", openLog);

  // ---- iPhone notifications (Web Push)
  const b64u = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4), raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); };
  function pushState() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
    return Notification.permission; // default | granted | denied
  }
  async function enablePush() {
    if (!state.api) throw new Error("not-connected");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("permission was not given");
    const { key } = await apiPost("/api/push/key", {});
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(key) }));
    await apiPost("/api/push/subscribe", { subscription: sub.toJSON() });
    store.set("archer-push", true);
  }
  function notifSection() {
    const st = pushState(), on = st === "granted" && store.get("archer-push", false);
    if (st === "unsupported") return `<div class="note-card"><b>iPhone notifications</b> need Archer opened from your Home Screen (Share → Add to Home Screen) on iOS 16.4 or later.</div>`;
    if (!state.api) return `<div class="note-card"><b>iPhone notifications</b> come from your server. Connect it first (tap ✦ and type the code from <code>fm api pair</code>).</div>`;
    return `<div class="panel"><h3><span>iPhone notifications</span><span style="text-transform:none;letter-spacing:0">${on ? "on" : st === "denied" ? "blocked" : "off"}</span></h3>
      <p style="margin:0 0 10px;font-size:14px">New favorites, players ruled OUT on your picks, line targets hit, and your bets during games: legs hitting, "needs just one", cashed.</p>
      ${st === "denied" ? `<p style="font-size:13px;color:var(--ink-3)">Notifications are blocked: Settings → Notifications → Archer.</p>` : `<div class="actions"><button class="btn primary grow" id="pushOn">${on ? "Re-register this phone" : "Enable notifications"}</button>${on ? '<button class="btn" id="pushTest">Test</button>' : ""}</div>`}<div class="foot" id="pushMsg" style="margin:8px 0 0"></div></div>`;
  }
  function bindNotif(root) {
    const on = $("#pushOn", root), test = $("#pushTest", root), msg = $("#pushMsg", root);
    if (on) on.addEventListener("click", async () => { msg.textContent = "Asking…"; try { await enablePush(); msg.textContent = "Done — a welcome notification is on its way."; buzz(); } catch (e) { msg.textContent = `Couldn't turn them on: ${e.message}`; } });
    if (test) test.addEventListener("click", async () => { try { const d = await apiPost("/api/push/test", {}); msg.textContent = d.sent ? "Sent." : "No phone registered yet."; } catch (e) { msg.textContent = e.message; } });
  }

  // ---- line targets
  state.targets = [];
  async function loadTargets() { if (!state.api) return; try { state.targets = (await apiPost("/api/targets", { action: "list" })).targets || []; if (state.tab === "today") renderToday(); } catch (_) { /* keep */ } }
  function openTarget(r) {
    const over = r.side === "over", step = r.market === "player_receptions" || r.market === "player_pass_tds" ? 1 : r.line >= 100 ? 5 : r.line >= 20 ? 2 : 1;
    const s = openSheet(`<div class="sh-top"><h2>Line alert</h2><button class="btn small" data-close>Done</button></div>
      <p style="margin-top:0"><b>${esc(r.player_ref)}</b> ${over ? "over" : "under"} ${r.line} ${esc(r.market_label || LABEL[r.market] || "")} · ${esc(bookName(r.book))}${r.dfs ? "" : " " + odds(r.price)}</p>
      <div class="field">Tell me when the line is ${over ? "at or below" : "at or above"}<input class="inp" id="tgLine" inputmode="decimal" value="${over ? r.line - step : r.line + step}"></div>
      ${r.dfs ? "" : `<div class="field">…or the price is at least (e.g. -105)<input class="inp" id="tgPrice" inputmode="numeric" placeholder="optional" value=""></div>`}
      <button class="btn primary" id="tgGo" style="width:100%">Set alert</button><div class="foot" id="tgMsg" style="margin:8px 0 0">Checked every time the board refreshes, no extra credits. You get one notification, then it clears.</div>`);
    $("#tgGo", s).addEventListener("click", async () => {
      if (!state.api) { $("#tgMsg", s).textContent = "Connect your server first (tap ✦)."; return; }
      const line = $("#tgLine", s).value.trim(), priceEl = $("#tgPrice", s), price = priceEl && priceEl.value.trim();
      try {
        await apiPost("/api/targets", { action: "add", target: { book: r.book, event_id: r.event_id, player_ref: r.player_ref, market: r.market, side: r.side, kick: r.commence_time, label: `${r.player_ref} ${over ? "O" : "U"} ${LABEL[r.market] || r.market}`, line: line === "" ? null : Number(line), price: price ? Number(price) : null } });
        closeSheet(); toast("Alert set — you'll get a notification"); loadTargets();
      } catch (e) { $("#tgMsg", s).textContent = e.message; }
    });
  }

  // ---- Today
  function trow(r, extra) {
    const lg = leagueOf(r), w = when(r.commence_time), be = r.breakeven_p ?? 0.524;
    return `<div class="trow" data-key="${esc(rowKey(r))}">${avatar(r.player_ref, lg, r.form_team, "sm")}
      <div><b>${esc(r.player_ref)}</b> <span style="color:var(--ink-3);font-weight:600">${r.side === "over" ? "O" : "U"} ${r.line} ${esc(r.market_label || LABEL[r.market] || "")}</span>
        <small>${esc(bookName(r.book))}${r.dfs ? " · needs " + pct(be) : " " + odds(r.price)}${w.txt ? " · " + esc(w.txt) : ""}${r.fav ? " · ★" : ""}</small>${extra || ""}</div>
      <div class="pv" style="color:${r.p_model >= be ? "var(--accent-2)" : "var(--ink-2)"}">${pct(r.p_model)}<small style="display:block;color:var(--ink-3)">${r.edge != null ? (r.edge > 0 ? "+" : "") + (r.edge * 100).toFixed(1) : ""}</small></div></div>`;
  }
  function renderToday() {
    const el = $("#today"); if (!el) return;
    const d = parseStamp(state.meta.as_of), age = ageText(d);
    $("#todaySub").textContent = age ? `board ${age} old` : "";
    const open = state.rows.filter((r) => !when(r.commence_time).locked && r.status !== "OUT");
    const hr = open.filter((r) => !r.dfs && leagueOf(r) === "nfl").sort((a, b) => (b.fav - a.fav) || ((b.off_market ? 1 : 0) - (a.off_market ? 1 : 0)) || ((b.edge ?? -1) - (a.edge ?? -1))).slice(0, 5);
    const soon = Date.now() + 40 * 3600000;
    const cfb = open.filter((r) => r.dfs && leagueOf(r) === "cfb" && Date.parse(r.commence_time) < soon).sort((a, b) => (b.fav - a.fav) || ((b.edge ?? -1) - (a.edge ?? -1))).slice(0, 4);
    const seenSpot = new Set();
    const spots = open.filter((r) => r.rank_head && (r.matchup_score ?? 0) >= 0.8 && (leagueOf(r) === "nfl" ? !r.dfs : r.dfs) && (r.p_model ?? 0) >= (r.breakeven_p ?? 0.524) - 0.03)
      .sort((a, b) => (b.matchup_score - a.matchup_score) || ((b.edge ?? -1) - (a.edge ?? -1)))
      .filter((r) => { const k = r.player_ref + r.market; if (seenSpot.has(k)) return false; seenSpot.add(k); return true; }).slice(0, 5);
    const offm = open.filter((r) => r.off_market && !r.dfs).sort((a, b) => b.market_edge - a.market_edge).slice(0, 3);
    const changed = state.rows.filter((r) => state.changes.has(rowKey(r))).sort((a, b) => (b.fav - a.fav) || ((b.edge ?? -1) - (a.edge ?? -1))).slice(0, 12);
    const byKey = new Map(state.rows.map((r) => [rowKey(r), r]));
    const moves = (state.meta.movers || []).map((m) => ({ m, r: byKey.get(rowKey(m)) })).filter((x) => x.r && !when(x.r.commence_time).locked).slice(0, 6);
    const live = liveBets(), m = todayMoney();
    const sec = (title, body, right) => `<div class="tsec"><h3><span>${title}</span>${right || ""}</h3>${body}</div>`;
    const since = state.seenAt ? ageText(new Date(state.seenAt)) : null;
    el.innerHTML = [
      overLimit() ? `<div class="warnbar">Today's loss limit is reached. Stepping away is the +EV move.</div>` : "",
      live.length ? sec("Live now", `<div class="trow live" data-go-bets><span style="display:grid;place-items:center"><i class="dot2" style="display:block;width:12px;height:12px;border-radius:50%;background:var(--red);animation:pulse 1.2s infinite"></i></span><div><b>${live.length} bet${live.length > 1 ? "s" : ""} in play</b><small>tap to sweat them</small></div><div class="pv">›</div></div>`) : "",
      state.bank && state.bank.roll ? sec("Your day", `<div class="trow" data-go-bets><span></span><div><b style="color:${m.pl >= 0 ? "var(--accent-2)" : "var(--red)"}">${m.pl >= 0 ? "+" : "−"}$${Math.abs(m.pl).toFixed(2)}</b><small>$${m.open.toFixed(0)} in play · ${m.n} bet${m.n === 1 ? "" : "s"} today${state.bank.limit ? ` · limit $${state.bank.limit}` : ""}</small></div><div class="pv">›</div></div>`) : "",
      sec("Best on Hard Rock · NFL", hr.length ? hr.map((r) => trow(r, `${chgTags(r)}${r.off_market ? `<span class="chg good">off-market +${(r.market_edge * 100).toFixed(1)}</span>` : ""}`)).join("") : `<div class="tempty">No NFL Hard Rock props on the board right now.</div>`),
      cfb.length ? sec("College pick'em", cfb.map((r) => trow(r, chgTags(r))).join("")) : "",
      spots.length ? sec("Best matchup spots", spots.map((r) => trow(r, `<span class="chg good">${esc(r.rank_head)}</span>${chgTags(r)}`)).join("")) : "",
      offm.length ? sec("Hard Rock off-market", offm.map((r) => trow(r, `<span class="chg good">market ${pct(r.p_market)} vs ${pct(r.breakeven_p)} needed · ${esc(r.market_books || "")}</span>`)).join("")) : "",
      sec(`Since you last looked${since ? ` · ${since} ago` : ""}`, (changed.length ? changed.map((r) => trow(r, chgTags(r))).join("") : `<div class="tempty">Nothing moved on the board since your last look.</div>`) + (state.newCount ? `<div class="foot" style="margin:4px 0 0">${state.newCount} new props posted.</div>` : ""), changed.length ? `<button id="seenAll">Mark seen</button>` : ""),
      moves.length ? sec(`Biggest moves${state.meta.movers[0] && parseStamp(state.meta.movers[0].since) ? " · since " + parseStamp(state.meta.movers[0].since).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}`, moves.map(({ m: mv, r }) => trow(r, `<span class="chg ${mv.fav && !mv.was_fav ? "fav" : ""}">${mv.was_line !== mv.line ? `line ${mv.was_line} → ${mv.line}` : ""}${!mv.dfs && mv.was_price !== mv.price ? ` ${odds(mv.was_price)} → ${odds(mv.price)}` : ""}${mv.fav && !mv.was_fav ? " · new ★" : ""}</span>`)).join("")) : "",
      state.targets.length ? sec("Your line alerts", state.targets.map((t) => `<div class="trow"><span class="mk2 p">🎯</span><div><b>${esc(t.label || t.player_ref)}</b><small>${t.line != null ? `line ${t.side === "over" ? "≤" : "≥"} ${t.line}` : ""}${t.line != null && t.price != null ? " or " : ""}${t.price != null ? `price ≥ ${odds(t.price)}` : ""} · ${esc(bookName(t.book))}</small></div><button class="btn small ghost danger" data-untarget="${esc(t.id)}">✕</button></div>`).join("")) : "",
    ].join("");
    el.onclick = async (e) => {
      if (e.target.closest("[data-go-bets]")) { show("bets"); return; }
      const un = e.target.closest("[data-untarget]"); if (un) { try { state.targets = (await apiPost("/api/targets", { action: "remove", id: un.dataset.untarget })).targets || []; renderToday(); } catch (_) { toast("Couldn't remove it"); } return; }
      if (e.target.closest("#seenAll")) { markSeen(); state.changes = new Map(); state.newCount = 0; state.seenAt = Date.now(); renderToday(); renderProps(); return; }
      const row = e.target.closest("[data-key]"); if (row) { const r = byKey.get(row.dataset.key); if (r) openPlayer(r); }
    };
    clearTimeout(seenTimer); seenTimer = setTimeout(() => { if (state.tab === "today" && !document.hidden) markSeen(); }, 5000);
  }

  // ---- pull to refresh (re-reads the published board; never spends credits)
  (() => {
    const ptr = $("#ptr"); let y0 = null, dy = 0, busy = false;
    window.addEventListener("touchstart", (e) => { if (!sheetEl && window.scrollY <= 0 && !busy) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
    window.addEventListener("touchmove", (e) => {
      if (y0 == null) return; dy = e.touches[0].clientY - y0;
      if (dy <= 0) { ptr.style.opacity = "0"; ptr.style.transform = "translateY(-70px)"; return; }
      const k = Math.min(1, dy / 90); ptr.style.opacity = String(k); ptr.style.transform = `translateY(${Math.min(dy, 110) * 0.6 - 20}px) rotate(${dy * 3}deg)`;
    }, { passive: true });
    window.addEventListener("touchend", async () => {
      if (y0 == null) return; y0 = null;
      if (dy < 90) { ptr.style.opacity = "0"; ptr.style.transform = "translateY(-70px)"; return; }
      busy = true; ptr.classList.add("spin"); ptr.style.transform = "translateY(30px)"; buzz();
      const changed = await refresh();
      ptr.classList.remove("spin"); ptr.style.opacity = "0"; ptr.style.transform = "translateY(-70px)"; busy = false;
      toast(changed ? "New board loaded" : "Already up to date");
    });
  })();

  // ------------------------------------------------------------------ ADR-0040: rankings
  state.gseg = "games"; state.rcat = store.get("archer-rcat", "rush_def"); state.rankings = null;
  const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const fmtVal = (v, f) => (v == null ? "—" : f === "epa" ? (v >= 0 ? "+" : "") + Number(v).toFixed(3) : f === "pct" ? pct(v, 1) : f === "ypr" ? Number(v).toFixed(2) : Number(v).toFixed(1));
  const rkCls = (rank, of) => (rank <= Math.max(3, Math.round(of * 0.15)) ? "top" : of - rank < Math.max(3, Math.round(of * 0.15)) ? "bot" : "");
  function rankBlock(lg) { return state.rankings && state.rankings.leagues && state.rankings.leagues[lg || state.league]; }
  function teamRanks(lg, team) {
    const b = rankBlock(lg); if (!b) return [];
    return b.categories.map((c) => { const r = c.rows.find((x) => x.team === team); return r ? { c, r, of: c.rows.length } : null; }).filter(Boolean);
  }
  function nextGame(lg, team) {
    const all = ((lg === "cfb" ? state.games.cfb_games : state.games.games) || []).filter((g) => g.home === team || g.away === team);
    all.sort((a, b) => String(a.kickoff_utc).localeCompare(String(b.kickoff_utc)));
    const g = all.find((x) => !when(x.kickoff_utc).locked) || all[0];
    return g ? { g, opp: g.home === team ? g.away : g.home, home: g.home === team } : null;
  }
  function renderRankings() {
    const el = $("#ranksPane"), lg = state.league, b = rankBlock(lg);
    if (!b || !b.categories || !b.categories.length) { el.innerHTML = `<div class="empty" style="margin-top:12px"><b>No rankings yet</b>They publish with the next board.</div>`; return; }
    if (!b.categories.some((c) => c.key === state.rcat)) state.rcat = b.categories[0].key;
    const cat = b.categories.find((c) => c.key === state.rcat), of = cat.rows.length;
    const vals = cat.rows.map((r) => r.value), lo = Math.min(...vals), hi = Math.max(...vals);
    const groups = [...new Set(b.categories.map((c) => c.group))];
    el.innerHTML = `<div class="page-h"><h1>Rankings</h1><span class="sub">${b.through_week ? `through week ${b.through_week}` : ""}</span></div>
      <div class="rk-cats">${groups.map((g) => `<span class="rk-grp">${esc(g)}</span>` + b.categories.filter((c) => c.group === g).map((c) => `<button class="chip" data-rcat="${c.key}" aria-pressed="${c.key === state.rcat}">${esc(c.label)}</button>`).join("")).join("")}</div>
      <div class="panel"><h3><span>${esc(cat.label)}</span><span style="text-transform:none;letter-spacing:0">${esc(cat.unit)}${cat.better ? ` · ${cat.better === "low" ? "lower" : "higher"} is better` : ""}</span></h3>
        ${cat.rows.map((r) => { const t = team(lg, r.team), nx = nextGame(lg, r.team); const w = hi > lo ? ((cat.better === "low" ? hi - r.value : r.value - lo) / (hi - lo)) * 100 : 50;
          return `<div class="rk-row" data-team="${esc(r.team)}"><span class="rk-n ${cat.better ? rkCls(r.rank, of) : ""}">${r.rank}</span>${t && t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span></span>`}
            <div class="rk-nm">${esc((t && (t.nick || t.name)) || r.team)}<small>${[nx ? `next ${nx.home ? "vs" : "@"} ${esc(abbr(lg, nx.opp))}` : "", r.n ? `${r.n} plays` : ""].filter(Boolean).join(" · ")}</small><div class="rk-bar"><i style="width:${Math.max(4, w)}%"></i></div></div>
            <div class="rk-v">${fmtVal(r.value, cat.fmt)}</div></div>`; }).join("")}</div>
      <div class="foot">Adjusted for opponents: a unit that faced strong opponents is not ranked on raw numbers. Early in the season thin samples lean on last season. Plays: ${esc(lg === "cfb" ? "CFBD" : "nflverse")}; line play and coverage: PFF.</div>`;
    const on = el.querySelector('.rk-cats [aria-pressed="true"]'), bar = el.querySelector(".rk-cats");
    if (on && bar) bar.scrollLeft = on.offsetLeft - bar.clientWidth / 2 + on.clientWidth / 2;
    el.onclick = (e) => {
      const c = e.target.closest("[data-rcat]"); if (c) { state.rcat = c.dataset.rcat; store.set("archer-rcat", state.rcat); renderRankings(); return; }
      const t = e.target.closest("[data-team]"); if (t) openTeam(t.dataset.team, lg);
    };
  }
  const PAIRS = [["rush_off", "rush_def", "Run game"], ["pass_off", "pass_def", "Passing game"], ["run_block", "run_stop", "Run blocking vs run stopping"], ["pass_pro", "pass_rush", "Protection vs pass rush"]];
  function openTeam(tid, lg) {
    const t = team(lg, tid), mine = teamRanks(lg, tid), nx = nextGame(lg, tid);
    const theirs = nx ? teamRanks(lg, nx.opp) : [], rk = (list, key) => list.find((x) => x.c.key === key);
    const badge = (x) => (x ? `<span class="rkb ${x.c.better ? rkCls(x.r.rank, x.of) : ""}">${ordinal(x.r.rank)}</span>` : "—");
    const groups = [...new Set(mine.map((x) => x.c.group))];
    const vs = nx ? PAIRS.map(([a, d, label]) => { const us = rk(mine, a), them = rk(theirs, d), us2 = rk(mine, d), them2 = rk(theirs, a);
      return (us && them) || (us2 && them2) ? `<tr><td>${label}</td><td>${badge(us)}<br><small style="color:var(--ink-3)">${esc(abbr(lg, tid))} O</small></td><td>${badge(them)}<br><small style="color:var(--ink-3)">${esc(abbr(lg, nx.opp))} D</small></td></tr><tr><td></td><td>${badge(them2)}<br><small style="color:var(--ink-3)">${esc(abbr(lg, nx.opp))} O</small></td><td>${badge(us2)}<br><small style="color:var(--ink-3)">${esc(abbr(lg, tid))} D</small></td></tr>` : ""; }).join("") : "";
    openSheet(`<div class="sh-top"><button class="btn small" data-close>✕ Close</button></div>
      <div class="hero v3" style="--tc:${esc((t && t.color) || "#334155")};--tc2:${esc((t && t.color2) || (t && t.color) || "#334155")};min-height:120px"><div class="wm2">${esc(abbr(lg, tid))}</div>
        <div class="txt">${t && t.logo ? `<img class="tlogo" src="${esc(t.logo)}" alt="" onerror="this.remove()">` : ""}<div class="nm2">${esc((t && t.name) || tid)}</div>${nx ? `<div class="sub2">next: ${nx.home ? "vs" : "@"} ${esc(abbr(lg, nx.opp))} · ${esc(when(nx.g.kickoff_utc).txt)}</div>` : ""}</div></div>
      ${vs ? `<div class="panel"><h3><span>Matchup vs ${esc(abbr(lg, nx.opp))}</span><span style="text-transform:none;letter-spacing:0">league rank, 1 = best</span></h3><table class="vs-t">${vs}</table></div>` : ""}
      ${groups.map((g) => `<div class="panel"><h3>${esc(g)}</h3>${mine.filter((x) => x.c.group === g).map((x) => `<div class="rk-row" style="grid-template-columns:52px 1fr auto;cursor:default">${x.c.better ? badge(x) : `<span class="rkb">${ordinal(x.r.rank)}</span>`}<div class="rk-nm">${esc(x.c.label)}<small>${esc(x.c.unit)}</small></div><div class="rk-v">${fmtVal(x.r.value, x.c.fmt)}<small>of ${x.of}</small></div></div>`).join("")}</div>`).join("")}`, true);
  }
  function ranksPanel(r) {
    const items = r.ranks || [];
    if (!items.length && !r.sos_note) return "";
    const sos = r.p_sos != null ? `<div class="rank-li ${r.p_sos >= (r.breakeven_p ?? 0.524) ? "up" : "dn"}"><i>≈</i><span><b>Schedule-adjusted view (experimental):</b> projects ${Number(r.sos_mean).toFixed(1)} → ${pct(r.p_sos)} vs ${pct(r.breakeven_p)} needed. Graded weekly before it counts.</span></div>` : "";
    return `<div class="panel"><h3><span>Matchup ranks</span><span style="text-transform:none;letter-spacing:0">1 = best unit</span></h3>
      ${items.map((x) => `<div class="rank-li ${x.helps ? "up" : "dn"}"><i>${x.helps ? "▲" : "▼"}</i><span>${esc(x.text)}</span></div>`).join("")}
      ${r.sos_note ? `<div class="rank-li"><i>↺</i><span>${esc(r.sos_note)}</span></div>` : ""}${sos}</div>`;
  }
  function setGSeg(v) {
    state.gseg = v; $$("#gSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.gseg === v)));
    $("#ranksPane").classList.toggle("hidden", v !== "ranks"); $("#gamesPane").classList.toggle("hidden", v === "ranks");
    if (v === "ranks") renderRankings();
  }
  $("#gSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-gseg]"); if (b) setGSeg(b.dataset.gseg); });

  // ------------------------------------------------------------------ tabs, league, data
  const TABS = ["today", "props", "games", "slip", "bets", "record"];
  function show(tab) {
    if (!TABS.includes(tab)) tab = "today";
    state.tab = tab;
    const hl = tab === "record" ? "bets" : tab;
    $$(".tabbar button").forEach((x) => x.setAttribute("aria-selected", String(x.dataset.tab === hl)));
    for (const v of TABS) $(`#${v}View`).classList.toggle("hidden", tab !== v);
    $("#leagueSeg").style.visibility = ["props", "games", "record"].includes(tab) ? "visible" : "hidden";
    store.set("archer-tab", tab);
    if (tab === "slip") renderSlip();
    if (tab === "bets") { renderBets(); pollLive(); }
    if (tab === "record") renderRecord();
    if (tab === "today") { renderToday(); loadTargets(); }
    moveInd();
    window.scrollTo({ top: 0 });
  }
  function moveInd() {
    const b = $(`.tabbar button[data-tab="${state.tab === "record" ? "bets" : state.tab}"]`), ind = $("#tabInd");
    if (!b || !ind) return;
    const wrap = b.parentElement.getBoundingClientRect(), r = b.getBoundingClientRect();
    ind.style.transform = `translateX(${r.left - wrap.left + r.width / 2 - 14}px)`;
  }
  window.addEventListener("resize", moveInd);
  $(".tabbar").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { closeSheet(); show(b.dataset.tab); } });
  function setLeague(lg) {
    state.league = lg; store.set("archer-league", lg);
    $$("#leagueSeg button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.league === lg)));
    state.f.market = "all"; state.f.book = "all"; saveF();
    renderProps(); renderGames(); if (state.tab === "record") renderRecord(); if (state.gseg === "ranks") renderRankings();
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
  const hideSplash = () => { const sp = $("#splash"); if (sp) { sp.classList.add("gone"); setTimeout(() => sp.remove(), 600); } };
  setTimeout(hideSplash, 1400);
  function applyBoard(data) {
    if (!data) { $("#meta").textContent = "No board published yet"; $("#list").innerHTML = `<div class="empty"><b>No board yet</b>It publishes after the next line snapshot.</div>`; renderTops(); return; }
    state.rows = data.rows || []; state.meta = data.meta || {}; state.asOf = state.meta.as_of;
    const h = store.get("archer-hidden", null); if (h && h.asOf === state.asOf) state.hidden = new Set(h.keys || []);
    const d = parseStamp(state.meta.as_of), age = ageText(d), stale = d && Date.now() - d.getTime() > 6 * 3600 * 1000;
    $("#meta").textContent = age ? `Lines ${age} old · pull down to refresh` : "Board loaded";
    $("#refreshPill").classList.toggle("stale", !!stale);
    $("#stamp").textContent = `Board ${state.meta.as_of || ""} · exported ${state.meta.exported_at || ""}`;
    computeChanges(); renderProps(); if (state.tab === "slip") renderSlip(); if (state.tab === "today") renderToday();
  }
  // everything the app reads is the published board; refreshing it never spends Odds API credits
  async function loadData() {
    const before = state.asOf;
    const [data, g, r, h, rk] = await Promise.all([get("screen.json"), get("games.json"), get("results.json"), get("history.json"), get("rankings.json"), assetsReady]);
    state.rankings = rk; if (state.gseg === "ranks") renderRankings();
    applyBoard(data);
    state.games = g || {}; renderGames();
    state.results = r; state.history = h;
    if (r) { state.bets.forEach(settle); saveBets(); if (state.tab === "bets") renderBets(); }
    if (state.tab === "record") renderRecord();
    $("#newBoard").classList.add("hidden");
    return !!before && before !== state.asOf;
  }
  const refresh = () => loadData().then((c) => { syncBets(); loadTargets(); return c; });
  loadData().finally(() => setTimeout(hideSplash, 150)).then(() => { syncBets(); loadTargets(); });
  // a new board lands roughly every 15 minutes on game days: offer it without losing your place
  setInterval(() => { get("meta.json").then((m) => { if (m && state.asOf && m.as_of && m.as_of !== state.asOf) $("#newBoard").classList.remove("hidden"); }); }, 180000);
  // countdowns tick while the app is open
  setInterval(() => { if (state.tab === "props" && !sheetEl) renderTops(); }, 60000);

  $$("#leagueSeg button").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.league === state.league)));
  saveSlip();
  const hashTab = location.hash.replace("#", "");
  show(TABS.includes(hashTab) ? hashTab : store.get("archer-tab", "today"));
  if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", (e) => { const t = String((e.data && e.data.go) || "").split("#")[1]; if (TABS.includes(t)) { closeSheet(true); show(t); } });
  window.addEventListener("hashchange", () => { const t = location.hash.replace("#", ""); if (TABS.includes(t)) { closeSheet(true); show(t); } });
  $$("[data-go]").forEach((b) => b.addEventListener("click", () => show(b.dataset.go)));
  pollLive(); // the Bets tab's live dot, and live numbers if a bet is in play

  if ("serviceWorker" in navigator) {
    let had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (had) location.reload(); had = true; });
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => {});
  }
})();
