// Soccer in the Archer app (docs/soccer_decisions.md S-020). Loaded by the football app only
// when Soccer is chosen (or once Today has drawn), and drawn with football's own components
// through window.Archer: the same cards, sheets, charts and chips. Everything here is testing:
// every number is Unproven until the December verdicts, and there is no "Bet now".
(() => {
  const A = window.Archer;
  if (!A) return;
  const { esc, pct, fmt1, when, openSheet, statChart, ring, buzz, store } = A;
  const $ = (s, el = document) => el.querySelector(s);

  const LEAGUES = { epl: "Premier League", laliga: "LaLiga", ucl: "Champions League", mls: "MLS" };
  const SHORT = { epl: "EPL", laliga: "LaLiga", ucl: "UCL", mls: "MLS" };
  const BOOK = { fanduel: "FanDuel", hardrockbet: "Hard Rock", hardrockbet_fl: "Hard Rock", underdog: "Underdog", prizepicks: "PrizePicks" };
  const DOT = { fanduel: "#1493FF", hardrockbet: "#D4AF37", hardrockbet_fl: "#D4AF37", underdog: "#F5C518", prizepicks: "#8B5CF6" };
  const PROP = { shots: "Shots", shots_on_target: "Shots on target", goals: "Anytime goal", assists: "Assists", passes: "Passes", tackles: "Tackles", saves: "Saves" };
  const KEY = { shots: "shots", shots_on_target: "sot", goals: "goal", assists: "assist", passes: "passes", tackles: "tackles", saves: "saves" };
  const MK = [["shots", "Shots"], ["sot", "On target"], ["goal", "Goal"], ["assist", "Assist"], ["passes", "Passes"], ["tackles", "Tackles"], ["saves", "Saves"]];
  const UNIT = { shots: "shots", sot: "on target", goal: "to score", assist: "to assist", passes: "passes", tackles: "tackles", saves: "saves" };
  const S = { slate: null, tables: null, teams: {}, lg: store.get("soccer-lg", "all"), day: "all", mk: store.get("soccer-mk", "shots"), seg: "games", tlg: null, loading: null };
  const get = (f) => fetch(`./soccer/data/${f}?v=${Date.now()}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  // --------------------------------------------------------------- data
  function load() {
    if (!S.loading) S.loading = Promise.all([get("slate.json"), get("tables.json")]).then(([sl, tb]) => { S.slate = sl; S.tables = tb; });
    return S.loading;
  }
  const teamFile = (id) => (S.teams[id] ? Promise.resolve(S.teams[id]) : get(`teams/${id}.json`).then((t) => (S.teams[id] = t || { players: {} })));
  const T = (id) => (S.slate && S.slate.teams[String(id)]) || { name: String(id) };
  const col = (id) => T(id).color || "#334155";
  const ab = (id) => { const t = T(id); return t.short || String(t.name || id).slice(0, 3).toUpperCase(); };
  const nm = (id) => T(id).name || String(id);
  const am = (d) => (!d ? "—" : d >= 2 ? "+" + Math.round((d - 1) * 100) : String(Math.round(-100 / (d - 1))));
  const fairAm = (p) => (p > 0 && p < 1 ? am(1 / p) : "—");
  const initials = (n) => String(n || "").split(/\s+/).filter(Boolean).map((w) => w[0]).slice(-2).join("").toUpperCase();
  const surname = (n) => { const w = String(n || "").split(/\s+/); return w.length > 1 ? w.slice(1).join(" ") : n; };
  const age = (dob) => { if (!dob) return null; const d = new Date(dob), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
  const logo = (id, cls) => { const t = T(id); return t.logo ? `<img class="${cls || ""}" src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.remove()">` : ""; };
  const logoBox = (id) => { const t = T(id); return t.logo ? `<img class="lg" src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="fb" style="--tc:${esc(col(id))}">${esc(ab(id).slice(0, 4))}</span>`; };
  function avatar(p, tid, size) {
    return `<div class="av ${size || ""}" style="--tc:${esc(col(tid))}"><span class="ini">${esc(initials(p.name))}</span>${p.img ? `<img class="face" src="${esc(p.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}${T(tid).logo ? `<span class="tbadge"><img src="${esc(T(tid).logo)}" alt="" loading="lazy" onerror="this.parentNode.remove()"></span>` : ""}</div>`;
  }
  const unproven = `<span class="tag warn" title="Soccer is in testing: calibration and closing-line tests finish in early December">Unproven</span>`;
  const leagueOk = (m) => S.lg === "all" || m.league === S.lg;
  const upcoming = (m) => !when(m.kickoff).locked;
  const matchesFor = (filterDay) => (S.slate ? S.slate.matches : []).filter(leagueOk).filter((m) => {
    if (!filterDay || S.day === "all") return true;
    const d = new Date(m.kickoff), t = new Date(); t.setHours(0, 0, 0, 0);
    const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - t) / 864e5);
    return S.day === "today" ? diff === 0 : diff === 1;
  });

  // every XI player in upcoming matches, with his match and side
  function allPlayers(ms) {
    const out = [];
    for (const m of ms) for (const side of ["home", "away"]) for (const p of m.xi[side].players) out.push({ p, m, side, tid: side === "home" ? m.home : m.away, opp: side === "home" ? m.away : m.home });
    return out;
  }

  // --------------------------------------------------------------- shared pieces
  function css() {
    if ($("#soccerCss")) return;
    const st = document.createElement("style"); st.id = "soccerCss";
    st.textContent = `
      .wp3{display:flex;height:8px;border-radius:99px;overflow:hidden;background:var(--track);margin:4px 0}.wp3 span{display:block;height:100%}.wp3 .dr{background:var(--line-2)}
      .wpl3{display:grid;grid-template-columns:1fr auto 1fr;font-size:11.5px;color:var(--ink-3);font-weight:600}.wpl3 span:nth-child(2){text-align:center}.wpl3 span:last-child{text-align:right}
      .sstat{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.sstat span{font-size:12px;color:var(--ink-3);background:var(--surface-2);border:1px solid var(--line);border-radius:9px;padding:3px 9px}.sstat b{color:var(--ink);font-variant-numeric:tabular-nums}
      .pitch{position:relative;border-radius:16px;padding:12px 6px;background:linear-gradient(180deg,#1f7a44,#17653a);border:1px solid rgba(255,255,255,.12);overflow:hidden;margin-bottom:10px}
      .pitch:before{content:"";position:absolute;inset:8px;border:1.5px solid rgba(255,255,255,.28);border-radius:10px;pointer-events:none}
      .pitch:after{content:"";position:absolute;left:50%;top:8px;width:120px;height:44px;margin-left:-60px;border:1.5px solid rgba(255,255,255,.28);border-top:0;border-radius:0 0 8px 8px;pointer-events:none}
      .pitch .ln{position:relative;display:flex;justify-content:space-evenly;gap:4px;margin:6px 0;z-index:1}
      .pitch .pp{display:flex;flex-direction:column;align-items:center;gap:3px;width:64px;cursor:pointer;color:#fff;text-align:center}
      .pitch .pp .ph{width:42px;height:42px;border-radius:50%;background:var(--tc,#334155);border:2px solid rgba(255,255,255,.85);overflow:hidden;display:grid;place-items:center;font:700 14px var(--display);position:relative;box-shadow:0 4px 10px rgba(0,0,0,.35)}
      .pitch .pp .ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top}
      .pitch .pp .pn{font-size:11px;font-weight:700;line-height:1.1;text-shadow:0 1px 2px rgba(0,0,0,.6);max-width:64px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pitch .pp .ps{font-size:10px;font-weight:700;background:rgba(0,0,0,.35);border-radius:6px;padding:0 5px}
      .pitch .hd{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;color:#fff;font-size:12px;font-weight:700;padding:0 8px 4px}
      .pitch .hd img{width:20px;height:20px;object-fit:contain;vertical-align:middle;margin-right:6px}
      .stab{display:grid;grid-template-columns:30px 26px 1fr 28px 36px 38px;gap:8px;align-items:center;padding:8px 2px;border-top:1px solid var(--line);font-size:13px;font-variant-numeric:tabular-nums;cursor:pointer}
      .stab.h{cursor:default;color:var(--ink-3);font-size:11px;font-weight:700;text-transform:uppercase;border-top:0}
      .stab img{width:24px;height:24px;object-fit:contain}.stab .n{text-align:center;font:800 16px var(--display)}.stab .t{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700}.stab .c{text-align:center}.stab .spts{text-align:right;font:800 20px var(--display)}
      .stab .t small{display:block;font-weight:500;color:var(--ink-3);font-size:11px}
      .frm{display:inline-flex;gap:2px;margin-top:2px}.frm i{width:13px;height:13px;border-radius:3px;font:800 8.5px/13px Inter,sans-serif;font-style:normal;text-align:center;color:#fff}.frm .W{background:var(--accent)}.frm .D{background:var(--ink-3)}.frm .L{background:var(--red)}
      .stiles{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.stiles div{background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:8px 10px}.stiles b{display:block;font:700 21px var(--display);font-variant-numeric:tabular-nums}.stiles span{font-size:10.5px;color:var(--ink-3);text-transform:uppercase;letter-spacing:.06em}
      .chn{display:grid;grid-template-columns:1fr 58px 58px;gap:8px;align-items:center;padding:7px 0;border-top:1px solid var(--line);font-size:13.5px}.chn:first-of-type{border-top:0}.chn b{text-align:right;font:700 17px var(--display)}.chn small{text-align:right;color:var(--ink-3);font-variant-numeric:tabular-nums}
      .sgl{display:grid;grid-template-columns:52px 1fr repeat(6,30px);gap:6px;align-items:center;padding:7px 2px;border-bottom:1px solid var(--line);font-size:12.5px;font-variant-numeric:tabular-nums}.sgl.h{color:var(--ink-3);font-size:10.5px;font-weight:700;text-transform:uppercase}
      .sgl .o{display:flex;align-items:center;gap:5px;min-width:0;white-space:nowrap;overflow:hidden}.sgl .o img{width:16px;height:16px;object-fit:contain}.sgl .c{text-align:center}.sgl .r{font-size:11px;font-weight:700}.sgl .r.W{color:var(--accent-2)}.sgl .r.L{color:var(--red)}.sgl .r.D{color:var(--ink-3)}
      .schips{display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none}.schips::-webkit-scrollbar{display:none}.schips .chip{white-space:nowrap}
      .prow{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:10px 2px;border-top:1px solid var(--line);cursor:pointer}.prow:first-child{border-top:0}
      .prow .big{text-align:right;font:800 24px var(--display);line-height:1}.prow .big small{display:block;font:600 11px Inter,sans-serif;color:var(--ink-3)}
      .sq{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--line);cursor:pointer}.sq:first-child{border-top:0}
      .sq .who small{display:block;color:var(--ink-3);font-size:12px}
      .inj{font-size:13px;color:var(--ink-2);padding:4px 0}.inj b{color:var(--ink)}
      .spos{display:grid;grid-template-columns:92px 1fr;gap:14px;align-items:center;padding-bottom:12px;border-bottom:1px solid var(--line);margin-bottom:8px}
      .spos svg{width:92px;height:auto;display:block}.spos .spt small{display:block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}.spos .spt b{display:block;font:700 17px var(--display);color:var(--ink)}.spos .spt .al{font-size:13.5px;color:var(--ink-2);line-height:1.5}.spos .spt .al i{font-style:normal;color:var(--ink-3)}.spos .spt div+div{margin-top:10px}
      .hexw{max-width:360px;margin:0 auto}.hexw svg{width:100%;height:auto;display:block;overflow:visible}
      .hexw .sp{cursor:pointer}.hexw .sp:focus{outline:none}.hexw .sp.on .lb,.hexw .sp:focus-visible .lb{fill:var(--accent);font-weight:700}
      .hexo{min-height:38px;font-size:13px;color:var(--ink-2);text-align:center;padding:2px 6px 8px}.hexo b{color:var(--ink)}
      .hexk{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;font-size:11.5px;color:var(--ink-3);padding-bottom:4px}.hexk i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:0}
      .hexk .pr{background:var(--accent)}.hexk .dr{border:1.5px solid var(--accent)}.hexk .md{width:16px;height:0;border-radius:0;border-top:1.5px dashed var(--ink-3);vertical-align:3px}
      .hext{display:grid;grid-template-columns:1fr 64px 1fr 34px;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--line);font-size:12.5px;font-variant-numeric:tabular-nums}
      .hext .v{text-align:right;color:var(--ink-2)}.hext .bar{height:6px;border-radius:99px;background:var(--track);overflow:hidden}.hext .bar span{display:block;height:100%;border-radius:99px;background:var(--accent)}.hext .n{text-align:right;font-weight:700}`;
    document.head.appendChild(st);
  }
  function wp3(m) {
    const p = m.proj.p, h = p[0], d = p[1], a = p[2];
    return `<div class="wp3"><span style="width:${h * 100}%;background:${esc(col(m.home))}"></span><span class="dr" style="width:${d * 100}%"></span><span style="width:${a * 100}%;background:${esc(col(m.away))}"></span></div>
      <div class="wpl3"><span>${esc(ab(m.home))} ${pct(h)}</span><span>draw ${pct(d)}</span><span>${pct(a)} ${esc(ab(m.away))}</span></div>`;
  }
  function sbSide(id, cls) {
    const c = col(id), n = nm(id), sz = n.length > 14 ? "xl" : n.length > 9 ? "l" : "";
    const lg = T(id).logo ? `<img src="${esc(T(id).logo)}" alt="" loading="lazy" onerror="this.remove()">` : `<span class="fb">${esc(ab(id))}</span>`;
    return `<div class="side ${cls}" style="background:linear-gradient(${cls === "h" ? "250deg" : "110deg"}, ${esc(c)}, color-mix(in srgb, ${esc(c)} 55%, #070B12))">${lg}<div class="nm3 ${sz}">${esc(n)}<small>${esc(ab(id))}</small></div></div>`;
  }
  function scoreMid(m) {
    const fin = m.score && ["FT", "AET", "FT_PEN"].includes(m.state), live = m.score && !fin && m.state !== "NS";
    if (m.score && (fin || live)) return `<div class="sc2"><span style="margin:0;color:inherit">${m.score[0]}</span><span>–</span><span style="margin:0;color:inherit">${m.score[1]}</span></div><div class="lbl3" style="${live ? "color:var(--red)" : ""}">${esc(live ? m.state_name || "live" : "full time")}</div>`;
    const x = m.proj.xg, hi = x[0] >= x[1];
    return `<div class="sc2"><span class="${hi ? "" : "lo"}" style="margin:0;color:inherit">${fmt1(x[0])}</span><span>–</span><span class="${hi ? "lo" : ""}" style="margin:0;color:inherit">${fmt1(x[1])}</span></div><div class="lbl3">projected goals</div>`;
  }
  const srcLine = (m) => m.proj.source.kind === "market" ? `from ${(m.proj.source.books || []).map((b) => BOOK[b] || b).join(", ") || "the books"}'s prices, margin removed` : m.proj.source.kind === "model" ? "from our team ratings: no market prices yet" : "from league averages: no market prices yet";
  function lineCount(m) { let n = 0; for (const s of ["home", "away"]) for (const p of m.xi[s].players) n += (p.lines || []).length; return n; }
  function matchCard(m, i) {
    const n = lineCount(m), xi = m.xi.home.status === "confirmed" ? "XIs confirmed" : "XIs projected";
    return `<div class="gcard sb" data-m="${i}">
      <div class="sbh">${sbSide(m.home, "a")}<div class="mid3">${scoreMid(m)}</div>${sbSide(m.away, "h")}</div>
      <div class="gbody">
        <div class="gtop">${A.countdown(m.kickoff)}<span class="mk">${esc(LEAGUES[m.league] || m.league)}${m.venue && m.venue.name ? " · " + esc(m.venue.name) : ""}</span></div>
        <div style="margin-top:10px">${wp3(m)}</div>
        <div class="sstat"><span>Over 2.5 <b>${pct(m.proj.over25)}</b></span><span>Both score <b>${pct(m.proj.btts)}</b></span><span>Likeliest <b>${m.proj.top[0]}–${m.proj.top[1]}</b></span><span>${xi}</span></div>
        <div class="glink"><span>Match page${n ? ` · ${n} prop lines` : ""}</span><span>›</span></div></div></div>`;
  }

  // --------------------------------------------------------------- Games / Table
  let shown = [];
  function renderGames(el) {
    const seg = `<div class="seg2" role="group"><button data-sseg="games" aria-pressed="${S.seg === "games"}">Matches</button><button data-sseg="table" aria-pressed="${S.seg === "table"}">Table</button></div>`;
    if (S.seg === "table") { el.innerHTML = seg + tablePane(); bindGames(el); return; }
    shown = matchesFor(true);
    const lgs = ["all", ...Object.keys(LEAGUES).filter((k) => S.slate.matches.some((m) => m.league === k))];
    el.innerHTML = `${seg}<div class="page-h"><h1>Matches</h1><span class="sub">${shown.length} of ${S.slate.matches.length}</span></div>
      <div class="schips">${lgs.map((k) => `<button class="chip" data-slg="${k}" aria-pressed="${S.lg === k}">${k === "all" ? "All" : esc(LEAGUES[k])}</button>`).join("")}</div>
      <div class="chips" style="margin-bottom:10px">${["today", "tomorrow", "all"].map((d) => `<button class="chip" data-sday="${d}" aria-pressed="${S.day === d}">${d === "all" ? "All matches" : d[0].toUpperCase() + d.slice(1)}</button>`).join("")}</div>
      <div class="note-card"><b>Testing · Unproven.</b> Match chances come from the betting market (our own team ratings lost to the closing line, S-008), so read them as the market's view. Player numbers are our props model: unproven until the December tests, and no "Bet now" here.</div>
      ${shown.length ? shown.map(matchCard).join("") : `<div class="empty"><b>No matches ${S.day === "all" ? "yet" : S.day}</b>Matches appear up to 8 days ahead.</div>`}
      <div class="foot">Projected goals are what the prices imply for each side. XIs are projected from recent starts in the current squad until the confirmed lineups land, about an hour before kickoff. Tap a match for its page.</div>`;
    bindGames(el);
  }
  function bindGames(el) {
    el.onclick = (e) => {
      const sg = e.target.closest("[data-sseg]"); if (sg) { S.seg = sg.dataset.sseg; buzz(); renderGames(el); return; }
      const l = e.target.closest("[data-slg]"); if (l) { S.lg = l.dataset.slg; store.set("soccer-lg", S.lg); renderGames(el); return; }
      const d = e.target.closest("[data-sday]"); if (d) { S.day = d.dataset.sday; renderGames(el); return; }
      const tl = e.target.closest("[data-tlg]"); if (tl) { S.tlg = tl.dataset.tlg; renderGames(el); return; }
      const t = e.target.closest("[data-team]"); if (t) { openTeam(Number(t.dataset.team)); return; }
      const c = e.target.closest("[data-m]"); if (c) openMatch(shown[Number(c.dataset.m)]);
    };
  }
  const formDots = (f) => (f ? `<span class="frm">${[...f].map((x) => `<i class="${x}">${x}</i>`).join("")}</span>` : "");
  function tablePane() {
    const lgs = Object.keys((S.tables && S.tables.leagues) || {});
    if (!lgs.length) return `<div class="empty" style="margin-top:12px"><b>No tables yet</b>They publish with the next soccer update.</div>`;
    if (!lgs.includes(S.tlg)) S.tlg = lgs.includes(S.lg) ? S.lg : lgs[0];
    const tb = S.tables.leagues[S.tlg], n = tb.rows.length;
    return `<div class="page-h"><h1>Table</h1><span class="sub">${esc(tb.name)}</span></div>
      <div class="schips">${lgs.map((k) => `<button class="chip" data-tlg="${k}" aria-pressed="${S.tlg === k}">${esc(LEAGUES[k] || k)}</button>`).join("")}</div>
      <div class="panel"><div class="stab h"><span>#</span><span></span><span>Team</span><span class="c">P</span><span class="c">GD</span><span style="text-align:right">Pts</span></div>
      ${tb.rows.map((r) => `<div class="stab" data-team="${r.team}"><span class="n ${r.pos <= 4 ? "rk-n top" : r.pos > n - 3 ? "rk-n bot" : ""}">${r.pos}</span>${logo(r.team) || `<span></span>`}<span class="t">${esc(nm(r.team))}<small>${r.w != null ? `${r.w}W ${r.d ?? 0}D ${r.l ?? 0}L · ` : ""}${formDots(r.form)}</small></span><span class="c">${r.p ?? "—"}</span><span class="c">${r.gd != null ? (r.gd > 0 ? "+" : "") + r.gd : "—"}</span><span class="spts">${r.pts ?? "—"}</span></div>`).join("")}</div>
      <div class="foot">Form: last five, oldest first. Tap a team for its strength, fixtures and squad.</div>`;
  }

  // --------------------------------------------------------------- match page
  function pitch(xi, tid, m) {
    const ps = xi.players.slice();
    let lines;
    if (ps.length && ps.every((p) => p.row)) {
      const by = {}; ps.forEach((p) => { (by[p.row] = by[p.row] || []).push(p); });
      lines = Object.keys(by).map(Number).sort((a, b) => b - a).map((r) => by[r].sort((a, b) => (a.col || 0) - (b.col || 0)));
    } else {
      lines = ["FWD", "MID", "DEF", "GK"].map((g) => ps.filter((p) => p.pos === g)).filter((l) => l.length);
    }
    const cell = (p) => `<div class="pp" data-pp="${p.pid}" data-tid="${tid}"><div class="ph" style="--tc:${esc(col(tid))}">${esc(p.num ?? initials(p.name))}${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ""}</div><div class="pn">${esc(surname(p.short || p.name))}</div>${xi.status === "projected" ? `<div class="ps">${pct(p.p_start)}</div>` : p.num != null ? `<div class="ps">#${esc(p.num)}</div>` : ""}</div>`;
    return `<div class="pitch"><div class="hd"><span>${logo(tid)}${esc(nm(tid))}</span><span>${esc(xi.formation || "")} · ${xi.status === "confirmed" ? "confirmed" : "projected"}</span></div>${lines.map((l) => `<div class="ln">${l.map(cell).join("")}</div>`).join("")}</div>`;
  }
  function glance(m) {
    const p = m.proj.p, x = m.proj.xg, fav = p[0] >= p[2] ? m.home : m.away, fp = Math.max(p[0], p[2]);
    const tot = x[0] + x[1], pts = [];
    pts.push({ t: `About ${tot.toFixed(1)} goals expected · over 2.5 ${pct(m.proj.over25)}, both teams score ${pct(m.proj.btts)}` });
    pts.push({ t: `Likeliest score ${m.proj.top[0]}–${m.proj.top[1]} (${pct(m.proj.top[2])}); a draw ${pct(p[1])}` });
    const outs = (m.out.home || []).length + (m.out.away || []).length;
    if (outs) pts.push({ t: `${outs} player${outs > 1 ? "s" : ""} out injured or suspended (below)` });
    pts.push({ t: `Chances ${srcLine(m)}` });
    return `<div class="panel glance"><div class="gh">${fp >= 0.5 ? `<b>${esc(nm(fav))}</b> favoured, ${pct(fp)} to win.` : `Close one: <b>${esc(ab(m.home))} ${pct(p[0])}</b>, draw ${pct(p[1])}, <b>${esc(ab(m.away))} ${pct(p[2])}</b>.`}</div>${pts.map((f) => `<div class="gf nt"><i>•</i><span>${esc(f.t)}</span></div>`).join("")}</div>`;
  }
  function projTable(m, side) {
    const tid = side === "home" ? m.home : m.away, xi = m.xi[side].players.filter((p) => p.proj);
    if (!xi.length) return "";
    const gk = xi.filter((p) => p.proj.saves), out = xi.filter((p) => !p.proj.saves);
    const v = (p, k, i) => { const e = p.proj[k]; if (!e) return "—"; return i == null ? fmt1(e.m) : pct(e.p && e.p[i]); };
    return `<div class="team-h">${logo(tid)}<b>${esc(nm(tid))}</b><span>${fmt1(side === "home" ? m.proj.xg[0] : m.proj.xg[1])} projected goals</span></div>
      <table class="pl"><thead><tr><th>Player</th><th>Min</th><th>Shots</th><th>SoT</th><th>Goal</th><th>Ast</th><th>Pass</th><th>Tkl</th></tr></thead><tbody>
      ${out.map((p) => `<tr class="plrow" data-pp="${p.pid}" data-tid="${tid}"><td>${p.img ? `<img class="mini" src="${esc(p.img)}" alt="" loading="lazy" onerror="this.remove()">` : ""}${esc(surname(p.short || p.name))}</td><td>${p.proj.min ?? "—"}</td><td>${v(p, "shots")}</td><td>${v(p, "sot")}</td><td>${v(p, "goal", 0)}</td><td>${v(p, "assist", 0)}</td><td>${p.proj.passes ? Math.round(p.proj.passes.m) : "—"}</td><td>${v(p, "tackles")}</td></tr>`).join("")}
      ${gk.map((p) => `<tr class="plrow" data-pp="${p.pid}" data-tid="${tid}"><td>${p.img ? `<img class="mini" src="${esc(p.img)}" alt="" loading="lazy" onerror="this.remove()">` : ""}${esc(surname(p.short || p.name))} <small style="color:var(--ink-3)">GK</small></td><td>${p.proj.min ?? "—"}</td><td colspan="6" style="text-align:left;color:var(--ink-2)">saves ${fmt1(p.proj.saves.m)} · 3+ ${pct(p.proj.saves.p && p.proj.saves.p[1])}</td></tr>`).join("")}
      </tbody></table>`;
  }
  function lineRows(list) {
    return list.map(({ p, l, tid }) => {
      const b = l.best || {}, side = b.side === "under" ? "under" : "over", pp = side === "over" ? l.p : 1 - l.p, price = b.price;
      const be = price ? 1 / price : 0.5, prop = PROP[l.prop] || l.prop;
      const lab = l.prop === "goals" ? (side === "over" ? "Scores" : "No goal") : `${side === "over" ? "Over" : "Under"} ${l.line} ${prop.toLowerCase()}`;
      return `<div class="partner" data-pp="${p.pid}" data-tid="${tid}" style="cursor:pointer">${avatar(p, tid, "sm")}<div class="who" style="flex:1"><b>${esc(p.name)}</b><small>${esc(lab)} · ${esc(BOOK[b.book] || b.book || "")} ${am(price)} · ours ${pct(pp)} (${fairAm(pp)})</small></div>${b.edge >= (S.slate.edge_min || 0.04) ? `<span class="verdict lean" title="Beats the book by ${(b.edge * 100).toFixed(1)} pts: unproven">+${(b.edge * 100).toFixed(1)}</span>` : `<span class="tag">${pct(pp)}</span>`}</div>`;
    }).join("");
  }
  function openMatch(m) {
    if (!m) return;
    const w = when(m.kickoff);
    const lines = []; for (const side of ["home", "away"]) for (const p of m.xi[side].players) for (const l of p.lines || []) lines.push({ p, l, tid: side === "home" ? m.home : m.away });
    lines.sort((a, b) => ((b.l.best || {}).edge ?? -1) - ((a.l.best || {}).edge ?? -1));
    const big = (id) => (T(id).logo ? `<img src="${esc(T(id).logo)}" alt="" onerror="this.remove()">` : `<span class="fb" style="--tc:${esc(col(id))}">${esc(ab(id))}</span>`);
    const outs = ["home", "away"].flatMap((s) => (m.out[s] || []).map((o) => ({ ...o, tid: s === "home" ? m.home : m.away })));
    const fin = m.score && ["FT", "AET", "FT_PEN"].includes(m.state);
    const s = openSheet(`<div class="sh-top"><button class="btn small" data-close>✕ Close</button><span class="when ${w.cls}" style="font-size:13px">${esc(w.txt)} · ${esc(SHORT[m.league] || m.league)}</span></div>
      <div class="ghero" style="--ca:${esc(col(m.home))};--ch:${esc(col(m.away))}">
        <div class="vs"><div data-team="${m.home}" style="cursor:pointer">${big(m.home)}<div class="tnm">${esc(nm(m.home))}</div><div class="sc">${m.score ? m.score[0] : fmt1(m.proj.xg[0])}</div></div>
          <div class="mid2">${m.score ? (fin ? "full time" : esc(m.state_name || "live")) : "projected goals"}</div>
          <div data-team="${m.away}" style="cursor:pointer">${big(m.away)}<div class="tnm">${esc(nm(m.away))}</div><div class="sc">${m.score ? m.score[1] : fmt1(m.proj.xg[1])}</div></div></div>
        <div style="margin-top:12px">${wp3(m)}</div></div>
      ${glance(m)}
      <div class="panel"><h3><span>Starting XIs</span><span style="text-transform:none;letter-spacing:0">${m.xi.home.status === "confirmed" ? "confirmed lineups" : "projected · % = start chance"}</span></h3>${pitch(m.xi.home, m.home, m)}${pitch(m.xi.away, m.away, m)}</div>
      ${outs.length ? `<div class="panel"><h3>Out</h3>${outs.map((o) => `<div class="inj">${logo(o.tid, "")}<b>${esc(o.name || "Player " + o.pid)}</b> · ${esc(o.why || "unavailable")}${o.until ? ` · until ${esc(new Date(o.until).toLocaleDateString([], { month: "short", day: "numeric" }))}` : ""}</div>`).join("")}</div>` : ""}
      ${lines.length ? `<div class="panel"><h3><span>Prop lines</span><span>${unproven}</span></h3>${lineRows(lines.slice(0, 40))}</div>` : ""}
      <div class="panel"><h3><span>Player projections</span><span style="text-transform:none;letter-spacing:0">if he starts · tap a player</span></h3>${projTable(m, "home")}${projTable(m, "away")}</div>
      ${m.venue && m.venue.name ? `<div class="foot">${esc(m.venue.name)}${m.venue.city ? ", " + esc(m.venue.city) : ""}${m.venue.capacity ? ` · capacity ${Number(m.venue.capacity).toLocaleString()}` : ""}</div>` : ""}`, true);
    s.addEventListener("click", (e) => {
      const pp = e.target.closest("[data-pp]"); if (pp) { openPlayer(Number(pp.dataset.pp), Number(pp.dataset.tid), m); return; }
      const t = e.target.closest("[data-team]"); if (t) openTeam(Number(t.dataset.team));
    });
  }

  // --------------------------------------------------------------- player page
  function findInSlate(pid) {
    for (const m of S.slate.matches) for (const side of ["home", "away"]) { const p = m.xi[side].players.find((x) => x.pid === pid); if (p && upcoming(m)) return { m, side, p }; }
    return null;
  }
  const LOGK = [["sh", "Shots"], ["sot", "On target"], ["g", "Goals"], ["xg", "xG"], ["a", "Assists"], ["pas", "Passes"], ["tkl", "Tackles"], ["sav", "Saves"], ["min", "Minutes"]];
  const LINEK = { sh: "shots", sot: "shots_on_target", g: "goals", a: "assists" }; // the books' props per chart
  const PROJK = { sh: "shots", sot: "sot", g: "goal", a: "assist", pas: "passes", tkl: "tackles", sav: "saves" };
  // ------------------------------------------------------------ traits and position (S-023)
  // Descriptive only: how he plays against his position, never a model input.
  const POSN = { GK: "Goalkeeper", LB: "Left back", CB: "Centre back", RB: "Right back", LWB: "Left wing-back", RWB: "Right wing-back", DM: "Defensive midfield", CM: "Central midfield", LM: "Left midfield", RM: "Right midfield", AM: "Attacking midfield", LW: "Left winger", RW: "Right winger", SS: "Second striker", ST: "Striker" };
  // x across (0 = left touchline), y up the pitch (0 = own goal line)
  const SPOT = { GK: [50, 7], LB: [16, 27], CB: [50, 23], RB: [84, 27], LWB: [13, 43], RWB: [87, 43], DM: [50, 39], CM: [50, 52], LM: [15, 57], RM: [85, 57], AM: [50, 66], LW: [18, 78], RW: [82, 78], SS: [50, 77], ST: [50, 88] };
  const ord = (n) => { const v = Math.round(n), t = v % 100; return v + (t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[v % 10] || "th"); };
  const PROPN = { shots: "shots", sot: "shots on target", goal: "anytime goal", assist: "assist", passes: "passes", tackles: "tackles", saves: "saves" };
  function posPitch(pos) {
    const W = 68, H = 100, at = (c) => { const [x, y] = SPOT[c] || SPOT.CM; return [x / 100 * W, H - y / 100 * H]; };
    const dot = (c, main) => { const [x, y] = at(c); return `<g><circle cx="${x}" cy="${y}" r="${main ? 8 : 6.5}" fill="${main ? "var(--accent)" : "var(--surface)"}" stroke="var(--accent)" stroke-width="${main ? 2 : 1.5}" ${main ? "" : 'stroke-dasharray="2 1.6"'}/><text x="${x}" y="${y + 2.4}" text-anchor="middle" font-size="${main ? 6.4 : 5.6}" font-weight="800" fill="${main ? "var(--accent-ink)" : "var(--ink-2)"}">${esc(c)}</text></g>`; };
    return `<svg viewBox="-2 -2 ${W + 4} ${H + 4}" role="img" aria-label="Position: ${esc(POSN[pos.main] || pos.main)}${(pos.others || []).length ? ", also " + pos.others.map((o) => POSN[o.c] || o.c).join(", ") : ""}">
      <rect x="0" y="0" width="${W}" height="${H}" rx="5" fill="var(--surface-2)" stroke="var(--line-2)"/>
      <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="var(--line-2)"/><circle cx="${W / 2}" cy="${H / 2}" r="9" fill="none" stroke="var(--line-2)"/>
      <rect x="${W / 2 - 17}" y="${H - 15}" width="34" height="15" fill="none" stroke="var(--line-2)"/><rect x="${W / 2 - 17}" y="0" width="34" height="15" fill="none" stroke="var(--line-2)"/>
      ${(pos.others || []).map((o) => dot(o.c, false)).join("")}${dot(pos.main, true)}</svg>`;
  }
  function hexagon(tr, on) {
    const cx = 170, cy = 122, R = 74, n = tr.spokes.length;
    const pt = (i, f) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [cx + R * f * Math.cos(a), cy + R * f * Math.sin(a)]; };
    const poly = (f) => tr.spokes.map((_, i) => pt(i, typeof f === "function" ? f(i) : f).map((v) => v.toFixed(1)).join(",")).join(" ");
    const rings = [0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${poly(f)}" fill="${f === 1 ? "var(--surface-2)" : "none"}" stroke="${f === 0.5 ? "var(--ink-3)" : "var(--line-2)"}" stroke-width="1" ${f === 0.5 ? 'stroke-dasharray="3 3"' : ""}/>`).reverse().join("");
    const axes = tr.spokes.map((_, i) => { const [x, y] = pt(i, 1); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line-2)"/>`; }).join("");
    const f = (i) => Math.max(0.03, (tr.spokes[i].pct ?? 0) / 100);
    const shape = `<polygon points="${poly(f)}" fill="var(--accent)" fill-opacity=".2" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
    const marks = tr.spokes.map((sp, i) => {
      const [x, y] = pt(i, f(i)), [lx, ly] = pt(i, 1.17), anchor = lx > cx + 8 ? "start" : lx < cx - 8 ? "end" : "middle";
      const top = ly < cy - R * 0.9, bottom = ly > cy + R * 0.9, y0 = top ? ly - 14 : bottom ? ly + 6 : ly - 4;
      const tag = sp.rel === "priced" ? `<circle cx="0" cy="0" r="3.2" fill="var(--accent)"/>` : sp.rel === "driver" ? `<circle cx="0" cy="0" r="2.8" fill="none" stroke="var(--accent)" stroke-width="1.3"/>` : "";
            return `<g class="sp${i === on ? " on" : ""}" data-sp="${i}" tabindex="0" role="button" aria-label="${esc(sp.label)}: ${sp.pct == null ? "no data" : ord(sp.pct) + " percentile"}">
        <circle class="hit" cx="${lx.toFixed(1)}" cy="${(y0 + 6).toFixed(1)}" r="22" fill="transparent"/>
        ${sp.pct == null ? "" : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`}
        <text class="lb" x="${lx.toFixed(1)}" y="${y0.toFixed(1)}" text-anchor="${anchor}" font-size="11" fill="var(--ink-2)">${tag ? `<tspan dx="0">${sp.rel === "priced" ? "●" : "○"}</tspan> ` : ""}${esc(sp.label)}</text>
        <text x="${lx.toFixed(1)}" y="${(y0 + 15).toFixed(1)}" text-anchor="${anchor}" font-size="13" font-weight="800" fill="var(--ink)">${sp.pct == null ? "—" : ord(sp.pct)}</text></g>`;
    }).join("");
    return `<svg viewBox="0 0 340 250" role="img" aria-label="Traits vs ${esc(tr.vs)}">${rings}${axes}${shape}${marks}</svg>`;
  }
  const spokeVal = (sp) => sp.v == null ? "—" : sp.unit === "%" ? `${Math.round(sp.v * 100)}%` : `${sp.v >= 10 ? Math.round(sp.v) : sp.v.toFixed(sp.v < 1 ? 2 : 1)} per 90`;
  function spokeText(tr, sp) {
    if (sp.pct == null) return `<b>${esc(sp.label)}</b>: not recorded for him yet`;
    const tag = sp.rel === "priced" ? ` · a prop we price` : sp.rel === "driver" ? ` · drives the ${esc(PROPN[sp.prop] || sp.prop)} prop` : "";
    return `<b>${esc(sp.label)}</b> ${esc(spokeVal(sp))} · <b>${ord(sp.pct)}</b> percentile${sp.low ? " (fewer ranks higher)" : ""}${tag}`;
  }
  function profilePanel(prof) {
    const tr = prof.traits, pos = prof.position;
    if (!tr && !pos) return "";
    const lg = tr && tr.league ? `${SHORT[tr.league] || LEAGUES[tr.league] || tr.league} ` : "";
    const vs = tr ? `vs ${lg}${tr.vs}${tr.league ? "" : " in our leagues"}` : "";
    const first = tr ? Math.max(0, tr.spokes.findIndex((x) => x.rel === "priced" && x.pct != null)) : 0;
    return `<div class="panel"><h3><span>Profile</span><span style="text-transform:none;letter-spacing:0">${esc(vs)}${tr && tr.small ? ` · <span class="tag warn">small sample</span>` : ""}</span></h3>
      ${pos ? `<div class="spos">${posPitch(pos)}<div class="spt"><div><small>Main position</small><b>${esc(POSN[pos.main] || pos.main)}</b></div>${(pos.others || []).length ? `<div><small>Also started at</small><div class="al">${pos.others.map((o) => `${esc(POSN[o.c] || o.c)} <i>· ${o.n} start${o.n === 1 ? "" : "s"}</i>`).join("<br>")}</div></div>` : ""}</div></div>` : ""}
      ${tr ? `<div class="hexw" id="hexW">${hexagon(tr, first)}</div>
        <div class="hexo" id="hexO">${spokeText(tr, tr.spokes[first])}</div>
        <div class="hexk"><span><i class="pr"></i>prop we price</span><span><i class="dr"></i>drives a prop</span><span><i class="md"></i>50th percentile</span></div>
        <details class="gbg"><summary>The numbers <span class="chev">›</span></summary>${tr.spokes.map((x) => `<div class="hext"><span>${esc(x.label)}</span><span class="v">${esc(spokeVal(x).replace(" per 90", "/90"))}</span><span class="bar"><span style="width:${x.pct ?? 0}%"></span></span><span class="n">${x.pct == null ? "—" : ord(x.pct)}</span></div>`).join("")}
          <div class="foot" style="margin-top:6px">Per 90 minutes over the last 12 months (${tr.min.toLocaleString()} min), ranked among ${tr.n} ${esc(tr.vs)} with 450+ minutes. Describes how he plays; it is not an input to the projections.</div></details>` : ""}
    </div>`;
  }

  async function openPlayer(pid, tid, m0) {
    const tf = await teamFile(tid), prof = (tf.players || {})[String(pid)] || {};
    const hit = findInSlate(pid), m = (hit && hit.m) || m0, xp = (hit && hit.p) || {};
    const p = { ...prof, ...xp, name: xp.name || prof.name, img: xp.img || prof.img };
    const opp = m ? (m.home === tid ? m.away : m.home) : null, home = m && m.home === tid;
    const log = (prof.log || []).filter((g) => g.min > 0);
    const gk = p.pos === "GK" || (p.proj && p.proj.saves);
    let stat = store.get("soccer-stat", "sh"); if (gk && !["sav", "min", "pas"].includes(stat)) stat = "sav";
    const sub = [p.num != null ? `#${p.num}` : "", p.role || ({ GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" })[p.pos] || "", age(p.dob) ? `${age(p.dob)} yrs` : "", p.height ? `${p.height} cm` : "", p.nat || ""].filter(Boolean).join(" · ");
    const pr = p.proj || {};
    const tiles = gk
      ? [["saves", "saves"], ["passes", "passes"]].filter(([k]) => pr[k]).map(([k, lab]) => `<div><b>${fmt1(pr[k].m)}</b><span>proj ${lab}</span></div>`)
      : [["shots", "shots"], ["sot", "on target"], ["passes", "passes"]].filter(([k]) => pr[k]).map(([k, lab]) => `<div><b>${fmt1(pr[k].m)}</b><span>proj ${lab}</span></div>`)
        .concat(pr.goal ? [`<div><b>${pct(pr.goal.p[0])}</b><span>to score</span></div>`] : []).concat(pr.assist ? [`<div><b>${pct(pr.assist.p[0])}</b><span>to assist</span></div>`] : []).concat(pr.tackles ? [`<div><b>${fmt1(pr.tackles.m)}</b><span>proj tackles</span></div>`] : []);
    const ch = [];
    const addC = (lab, prob) => prob != null && ch.push(`<div class="chn"><span>${esc(lab)}</span><b>${pct(prob)}</b><small>${fairAm(prob)}</small></div>`);
    if (pr.shots) [1, 2, 3].forEach((k, i) => addC(`${k}+ shots`, pr.shots.p[i]));
    if (pr.sot) [1, 2].forEach((k, i) => addC(`${k}+ on target`, pr.sot.p[i]));
    if (pr.goal) addC("Anytime goal", pr.goal.p[0]);
    if (pr.assist) addC("Assist", pr.assist.p[0]);
    if (pr.tackles) [1, 2].forEach((k, i) => addC(`${k}+ tackles`, pr.tackles.p[i]));
    if (pr.saves) [2, 3, 4].forEach((k, i) => addC(`${k}+ saves`, pr.saves.p[i]));
    const whys = Object.entries(p.why || {}).map(([, t]) => `<li>${esc(t)}</li>`).join("");
    const lines = (p.lines || []).map((l) => ({ p, l, tid }));
    const seasonT = prof.season;
    const s = openSheet(`<div class="sh-top"><button class="btn small" data-close>✕ Close</button><span>${unproven}</span></div>
      <div class="hero v3" style="--tc:${esc(col(tid))};--tc2:${esc(col(tid))}">
        <div class="wm2">${esc(p.num ?? ab(tid))}</div>
        ${p.img ? `<img class="cut" src="${esc(p.img)}" alt="" referrerpolicy="no-referrer" style="border-radius:16px;height:150px;bottom:18px;right:14px" onerror="this.remove()">` : ""}
        <div class="txt">${T(tid).logo ? `<img class="tlogo" src="${esc(T(tid).logo)}" alt="" onerror="this.remove()">` : ""}<div class="nm2">${esc(p.name || "Player")}</div>
          <div class="sub2">${esc(sub)}</div>
          ${m ? `<div class="sub2" style="margin-top:6px">${logo(opp)}${home ? "vs" : "@"} ${esc(nm(opp))} · <span class="when ${when(m.kickoff).cls}">${esc(when(m.kickoff).txt)}</span>${xp.p_start != null ? ` · ${m.xi[home ? "home" : "away"].status === "confirmed" ? "starting" : `starts ${pct(xp.p_start)}`}` : ""}</div>` : ""}</div>
      </div>
      ${tiles.length ? `<div class="panel"><h3><span>This match${pr.min ? ` · about ${pr.min} min` : ""}</span><span style="text-transform:none;letter-spacing:0">if he starts</span></h3><div class="stiles">${tiles.slice(0, 6).join("")}</div></div>` : ""}
      ${ch.length ? `<div class="panel"><h3><span>Chances</span><span style="text-transform:none;letter-spacing:0">ours · fair odds</span></h3>${ch.join("")}</div>` : ""}
      ${lines.length ? `<div class="panel"><h3><span>Book lines</span><span>${unproven}</span></h3>${lineRows(lines)}</div>` : ""}
      ${whys ? `<div class="panel"><h3>Matchup</h3><ul class="whys">${whys}</ul></div>` : ""}
      <div class="panel form"><h3><span>Last ${log.length} matches</span><span class="hr" id="stHead" style="text-transform:none;letter-spacing:0"></span></h3>
        <div class="schips" id="stChips">${LOGK.filter(([k]) => !gk || ["sav", "pas", "min"].includes(k)).map(([k, lab]) => `<button class="chip" data-st="${k}" aria-pressed="${k === stat}">${lab}</button>`).join("")}</div>
        <div id="stChart"></div>
        ${log.length ? `<details class="gbg"><summary>Match by match <span class="chev">›</span></summary><div class="sgl h"><span>Date</span><span>Opp</span><span class="c">Min</span><span class="c">G</span><span class="c">A</span><span class="c">Sh</span><span class="c">${gk ? "Sv" : "SoT"}</span><span class="c">Rt</span></div>${log.map((g) => { const r = g.res ? (g.res[0] > g.res[1] ? "W" : g.res[0] === g.res[1] ? "D" : "L") : ""; return `<div class="sgl"><span style="color:var(--ink-3)">${esc(new Date(g.d + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" }))}</span><span class="o">${logo(g.opp)}${g.h ? "vs" : "@"} ${esc(ab(g.opp))} <span class="r ${r}" title="${g.res ? g.res[0] + "–" + g.res[1] : ""}">${r}</span></span><span class="c">${g.min ?? "—"}</span><span class="c">${g.g ?? 0}</span><span class="c">${g.a ?? 0}</span><span class="c">${g.sh ?? 0}</span><span class="c">${gk ? g.sav ?? 0 : g.sot ?? 0}</span><span class="c">${g.rt ?? "—"}</span></div>`; }).join("")}</details>` : ""}
      </div>
      ${profilePanel(prof)}
      ${seasonT ? `<div class="panel"><h3><span>This season</span><span style="text-transform:none;letter-spacing:0">${esc(LEAGUES[tf.league] || "")}</span></h3>
        <div class="kpis"><div class="kpi"><b>${seasonT.apps}</b><span>apps · ${seasonT.starts} st</span></div><div class="kpi"><b>${gk ? seasonT.sav : seasonT.g}</b><span>${gk ? "saves" : "goals"}</span></div><div class="kpi"><b>${gk ? seasonT.pas : seasonT.a}</b><span>${gk ? "passes" : "assists"}</span></div><div class="kpi"><b>${seasonT.min}</b><span>minutes</span></div></div>
        ${gk ? "" : `<div class="stiles"><div><b>${fmt1(seasonT.sh90)}</b><span>shots /90</span></div><div><b>${fmt1(seasonT.sot90)}</b><span>on target /90</span></div><div><b>${seasonT.xg90 != null ? seasonT.xg90.toFixed(2) : "—"}</b><span>xG /90</span></div><div><b>${fmt1(seasonT.pas90)}</b><span>passes /90</span></div><div><b>${fmt1(seasonT.tkl90)}</b><span>tackles /90</span></div><div><b>${seasonT.g90 != null ? seasonT.g90.toFixed(2) : "—"}</b><span>goals /90</span></div></div>`}</div>` : ""}
      <div class="foot">Projections assume he starts. Photos and data: Sportmonks. Soccer is in testing: nothing here is proven yet.</div>`, true);
    const draw = () => {
      const k = stat, pk = PROJK[k], pe = pk && pr[pk];
      const games = log.map((g) => ({ v: g[k] ?? 0, top: (g.h ? "" : "@") + ab(g.opp).slice(0, 4), sub: new Date(g.d + "T12:00:00").toLocaleDateString([], { month: "numeric", day: "numeric" }), title: `${g.d} ${g.h ? "vs" : "@"} ${nm(g.opp)}: ${g[k] ?? 0}` }));
      // the hatched bar is the props model's projection for this match (expected count; for
      // goals and assists the expected number, whose chance of 1+ is in Chances above)
      const proj = k === "min" ? pr.min : pe ? pe.m : null;
      // the book's line for this stat, when one is posted: bars go green / red against it
      const bl = LINEK[k] && (p.lines || []).find((l) => l.prop === LINEK[k]);
      const side = bl && bl.best && bl.best.side === "under" ? "under" : "over";
      const hits = bl ? games.filter((x) => (side === "over" ? x.v > bl.line : x.v < bl.line)).length : null;
      const avg = games.length ? games.reduce((a, x) => a + x.v, 0) / games.length : null;
      $("#stHead", s).innerHTML = bl
        ? `<b>${hits}</b> of ${games.length} ${side} ${bl.line} · ${esc(BOOK[(bl.best || {}).book] || "book")} line`
        : avg != null ? `avg <b>${k === "xg" ? avg.toFixed(2) : fmt1(avg)}</b>${proj != null ? ` · proj <b>${k === "xg" || pk === "goal" || pk === "assist" ? Number(proj).toFixed(2) : fmt1(proj)}</b>` : ""}` : "";
      $("#stChart", s).innerHTML = statChart(games, { proj, line: bl ? bl.line : undefined, side, label: `Last ${games.length} matches` }) || `<div class="empty" style="padding:14px">No recent matches</div>`;
    };
    draw();
    // hover (desktop) and Enter/Space (keyboard) read a spoke out the same way a tap does
    s.addEventListener("pointerover", (e) => { const hs = e.target.closest && e.target.closest("[data-sp]"); if (hs && e.pointerType === "mouse" && prof.traits) { s.querySelectorAll("#hexW .sp").forEach((g) => g.classList.toggle("on", g === hs)); $("#hexO", s).innerHTML = spokeText(prof.traits, prof.traits.spokes[Number(hs.getAttribute("data-sp"))]); } });
    s.addEventListener("keydown", (e) => { const hs = e.target.closest && e.target.closest("[data-sp]"); if (hs && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); hs.dispatchEvent(new MouseEvent("click", { bubbles: true })); } });
    s.addEventListener("click", (e) => {
      const hs = e.target.closest("[data-sp]"); if (hs && prof.traits) { const i = Number(hs.getAttribute("data-sp")); s.querySelectorAll("#hexW .sp").forEach((g) => g.classList.toggle("on", g === hs)); $("#hexO", s).innerHTML = spokeText(prof.traits, prof.traits.spokes[i]); buzz(); return; }
      const c = e.target.closest("[data-st]"); if (c) { stat = c.dataset.st; store.set("soccer-stat", stat); s.querySelectorAll("#stChips .chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c))); buzz(); draw(); return; }
      const pp = e.target.closest("[data-pp]"); if (pp && Number(pp.dataset.pp) !== pid) openPlayer(Number(pp.dataset.pp), Number(pp.dataset.tid), m);
    });
  }

  // --------------------------------------------------------------- team page
  const TMK = [["gf", "Goals"], ["ga", "Conceded"], ["xgf", "xG"], ["xga", "xG against"], ["shf", "Shots"], ["sha", "Shots against"]];
  async function openTeam(tid) {
    const tf = await teamFile(tid);
    const inTable = Object.entries((S.tables && S.tables.leagues) || {}).find(([, tb]) => tb.rows.some((r) => r.team === tid));
    const lgKey = tf.league || T(tid).league || (inTable && inTable[0]);
    const tb = S.tables && S.tables.leagues && S.tables.leagues[lgKey], row = tb && tb.rows.find((r) => r.team === tid), n = tb ? tb.rows.length : 0;
    const next = S.slate.matches.filter((m) => (m.home === tid || m.away === tid) && upcoming(m)).sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0];
    const players = Object.entries(tf.players || {}).map(([id, p]) => ({ pid: Number(id), ...p }));
    const order = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
    players.sort((a, b) => (order[a.pos] ?? 9) - (order[b.pos] ?? 9) || ((b.season && b.season.min) || 0) - ((a.season && a.season.min) || 0));
    const s = openSheet(`<div class="sh-top"><button class="btn small" data-close>✕ Close</button></div>
      <div class="hero v3" style="--tc:${esc(col(tid))};--tc2:${esc(col(tid))};min-height:120px"><div class="wm2">${esc(ab(tid))}</div>
        <div class="txt">${T(tid).logo ? `<img class="tlogo" src="${esc(T(tid).logo)}" alt="" onerror="this.remove()">` : ""}<div class="nm2">${esc(nm(tid))}</div>
        <div class="sub2">${row ? `${row.pos}${["th", "st", "nd", "rd"][row.pos % 10 > 3 || [11, 12, 13].includes(row.pos % 100) ? 0 : row.pos % 10]} in ${esc(tb.name)} · ${row.pts} pts` : esc(LEAGUES[lgKey] || "")}</div>
        ${tf.form ? `<div class="sub2" style="margin-top:6px">form ${formDots(tf.form.slice(-5))}</div>` : ""}</div></div>
      ${row && row.att_rank ? `<div class="panel"><h3><span>Strength</span><span style="text-transform:none;letter-spacing:0">our team ratings · 1 = best of ${n}</span></h3>
        <div class="stiles"><div><b>${row.att_rank}</b><span>attack · ${fmt1(row.att)} gls/g</span></div><div><b>${row.def_rank}</b><span>defence · ${fmt1(row.def)} conc/g</span></div><div><b>${row.gf ?? "—"}:${row.ga ?? "—"}</b><span>goals for:against</span></div></div></div>` : ""}
      ${(tf.matches || []).length ? `<div class="panel form"><h3><span>Last ${tf.matches.length} matches</span><span class="hr" id="tmHead" style="text-transform:none;letter-spacing:0"></span></h3>
        <div class="schips" id="tmChips">${TMK.map(([k, lab]) => `<button class="chip" data-tm="${k}" aria-pressed="${k === "gf"}">${lab}</button>`).join("")}</div><div id="tmChart"></div></div>` : ""}
      ${next ? `<div class="panel"><h3>Next match</h3>${matchCard(next, 0)}</div>` : ""}
      <div class="panel"><h3><span>Squad</span><span style="text-transform:none;letter-spacing:0">this season</span></h3>${players.length ? "" : `<div class="tempty">No squad on file yet: it arrives with this team's next match.</div>`}${players.map((p) => `<div class="sq" data-pp="${p.pid}">${avatar(p, tid, "sm")}<div class="who"><b>${esc(p.name || "")}</b><small>${[p.num != null ? "#" + p.num : "", p.role || p.pos || ""].filter(Boolean).map(esc).join(" · ")}</small></div><div style="text-align:right;font-size:12px;color:var(--ink-3)">${p.season ? `${p.season.apps} apps · ${p.pos === "GK" ? `${p.season.sav} sv` : `${p.season.g} g ${p.season.a} a`}` : "—"}</div></div>`).join("")}</div>`, true);
    // the hatched bar: next match's projected goals for / against (the market's, S-020)
    const side = next ? (next.home === tid ? 0 : 1) : 0;
    const tmDraw = (k) => {
      const ms = tf.matches || [];
      const games = ms.map((g) => ({ v: g[k] ?? 0, top: (g.h ? "" : "@") + ab(g.opp).slice(0, 4), sub: new Date(g.d + "T12:00:00").toLocaleDateString([], { month: "numeric", day: "numeric" }), title: `${g.d} ${g.h ? "vs" : "@"} ${nm(g.opp)}: ${g.gf}–${g.ga}` }));
      const proj = next && ["gf", "xgf"].includes(k) ? next.proj.xg[side] : next && ["ga", "xga"].includes(k) ? next.proj.xg[1 - side] : null;
      const avg = games.length ? games.reduce((a, x) => a + x.v, 0) / games.length : 0;
      $("#tmHead", s).innerHTML = `avg <b>${k.startsWith("xg") ? avg.toFixed(2) : fmt1(avg)}</b>${proj != null ? ` · next <b>${fmt1(proj)}</b>` : ""}`;
      $("#tmChart", s).innerHTML = statChart(games, { proj, label: `Last ${games.length} matches` });
    };
    if ($("#tmChart", s)) tmDraw("gf");
    s.addEventListener("click", (e) => {
      const c = e.target.closest("[data-tm]"); if (c) { s.querySelectorAll("#tmChips .chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c))); buzz(); tmDraw(c.dataset.tm); return; }
      const pp = e.target.closest("[data-pp]"); if (pp) { openPlayer(Number(pp.dataset.pp), tid); return; }
      if (next && e.target.closest("[data-m]")) openMatch(next);
    });
  }

  // --------------------------------------------------------------- Props
  let likes = [], rows = [];
  function renderProps(el) {
    const ms = S.slate.matches.filter(leagueOk).filter(upcoming);
    const all = allPlayers(ms);
    likes = [];
    for (const x of all) for (const l of x.p.lines || []) if (l.best && l.best.edge >= (S.slate.edge_min || 0.04)) likes.push({ ...x, l });
    likes.sort((a, b) => b.l.best.edge - a.l.best.edge);
    const key = S.mk, isP = key === "goal" || key === "assist";
    rows = all.filter((x) => x.p.proj && x.p.proj[key]).sort((a, b) => (isP ? b.p.proj[key].p[0] - a.p.proj[key].p[0] : b.p.proj[key].m - a.p.proj[key].m)).slice(0, 60);
    const lgs = ["all", ...Object.keys(LEAGUES).filter((k) => S.slate.matches.some((m) => m.league === k))];
    el.innerHTML = `<div class="page-h" style="margin-top:6px"><h1>Props</h1><span class="sub">soccer · testing</span></div>
      <div class="schips">${lgs.map((k) => `<button class="chip" data-slg="${k}" aria-pressed="${S.lg === k}">${k === "all" ? "All" : esc(LEAGUES[k])}</button>`).join("")}</div>
      <div class="note-card"><b>Testing · Unproven.</b> Our fair prices next to FanDuel and Hard Rock. The model has to pass its calibration and closing-line tests (early December) before anything here counts, so there is no "Bet now".</div>
      <div class="sec-h"><h2>Model likes</h2><span>${likes.length} · beats a book by ${Math.round((S.slate.edge_min || 0.04) * 100)}+ pts</span></div>
      <div>${likes.length ? likes.slice(0, 20).map(likeCard).join("") : `<div class="tempty">No book line clears the bar right now. Lines post about 6 hours before kickoff.</div>`}</div>
      <div class="sec-h"><h2>Projections</h2><span>if he starts</span></div>
      <div class="schips">${MK.map(([k, lab]) => `<button class="chip" data-smk="${k}" aria-pressed="${S.mk === k}">${lab}</button>`).join("")}</div>
      <div class="panel">${rows.length ? rows.map((x, i) => projRow(x, i)).join("") : `<div class="tempty">No projections yet for these matches.</div>`}</div>
      <div class="foot">Projections assume the player starts (projected XIs until lineups are confirmed). Tap a player for his page.</div>`;
    el.onclick = (e) => {
      const l = e.target.closest("[data-slg]"); if (l) { S.lg = l.dataset.slg; store.set("soccer-lg", S.lg); renderProps(el); return; }
      const k = e.target.closest("[data-smk]"); if (k) { S.mk = k.dataset.smk; store.set("soccer-mk", S.mk); buzz(); renderProps(el); return; }
      const c = e.target.closest("[data-like]"); if (c) { const x = likes[Number(c.dataset.like)]; openPlayer(x.p.pid, x.tid, x.m); return; }
      const r = e.target.closest("[data-row]"); if (r) { const x = rows[Number(r.dataset.row)]; openPlayer(x.p.pid, x.tid, x.m); }
    };
  }
  function likeCard(x, i) {
    const l = x.l, b = l.best, side = b.side === "under" ? "under" : "over", pp = side === "over" ? l.p : 1 - l.p, be = b.price ? 1 / b.price : 0.5;
    const w = when(x.m.kickoff), over = side === "over", isG = l.prop === "goals";
    const proj = x.p.proj && x.p.proj[KEY[l.prop]];
    return `<div class="card v3" data-like="${i}" style="--tc:${esc(col(x.tid))};cursor:pointer">
      <div class="row1">${avatar(x.p, x.tid)}
        <div class="who"><div class="nm">${esc(x.p.name)}</div><div class="ctx">${logo(x.opp)}${x.side === "home" ? "vs" : "@"} ${esc(ab(x.opp))}${w.txt ? ` · <span class="when ${w.cls}">${esc(w.txt)}</span>` : ""}</div>
          <div class="pick2" style="margin-top:6px"><span class="mkt">${esc(PROP[l.prop] || l.prop)}</span><span class="line" style="font-size:21px">${isG ? `<span class="dir ${over ? "o" : "u"}">${over ? "YES" : "NO"}</span>` : `<span class="dir ${over ? "o" : "u"}">${over ? "O" : "U"}</span><span class="num">${l.line}</span>`}</span><span class="verdict lean">+${(b.edge * 100).toFixed(1)} pts</span></div></div>
        <div style="text-align:center">${ring(pp, be)}</div></div>
      <div class="row2"><div class="subrow" style="margin-top:0">${b.book ? `<span class="book"><span class="sw" style="background:${DOT[b.book] || "#94A3B8"}"></span>${esc(BOOK[b.book] || b.book)} <b>${am(b.price)}</b></span>` : ""}${proj && proj.m != null && !isG ? `<span class="projc">Proj <b>${fmt1(proj.m)}</b> ${esc(UNIT[KEY[l.prop]] || "")}</span>` : ""}${unproven}${x.p.why && x.p.why[KEY[l.prop]] ? `<span class="tag good" title="${esc(x.p.why[KEY[l.prop]])}">matchup</span>` : ""}</div></div>
    </div>`;
  }
  function projRow(x, i) {
    const k = S.mk, e = x.p.proj[k], isP = k === "goal" || k === "assist";
    const big = isP ? pct(e.p[0]) : fmt1(e.m), small = isP ? fairAm(e.p[0]) : e.p ? `${k === "saves" ? 3 : 2}+ ${pct(e.p[k === "saves" ? 1 : 1])}` : UNIT[k];
    return `<div class="prow" data-row="${i}">${avatar(x.p, x.tid, "sm")}<div class="who"><b>${esc(x.p.name)}</b><small style="display:block;color:var(--ink-3);font-size:12px">${esc(ab(x.tid))} ${x.side === "home" ? "vs" : "@"} ${esc(ab(x.opp))} · ${esc(when(x.m.kickoff).txt)}${x.m.xi[x.side].status === "projected" ? ` · starts ${pct(x.p.p_start)}` : ""}</small></div><div class="big">${big}<small>${esc(small)}</small></div></div>`;
  }

  // --------------------------------------------------------------- Record
  function renderRecord(el) {
    const conf = S.slate.confirmation || {}, rec = S.slate.record || [];
    const cl = []; for (const [lg, props] of Object.entries(conf)) for (const [p, v] of Object.entries(props)) if (PROP[p]) cl.push({ lg, p, v });
    el.innerHTML = `<div class="page-h"><h1>How soccer is doing</h1><span class="sub">testing</span></div>
      <div class="note-card">Soccer goes live as <b>proven</b> only when a prop passes both tests: calibration on matches from 1 October, and beating the closing line (CLV) over 200+ flagged sides across 3+ weeks. Until then everything is Unproven.</div>
      <div class="panel"><h3><span>Against the closing line</span><span style="text-transform:none;letter-spacing:0">per book and prop</span></h3>${rec.length ? rec.map((r) => `<div class="chn"><span>${esc(BOOK[r.book] || r.book)} · ${esc(PROP[r.prop] || r.prop)}</span><small style="grid-column:span 2;text-align:right">${esc(r.verdict)}</small></div>`).join("") : `<div class="tempty">Starts with the first matches after lines are logged.</div>`}</div>
      <div class="panel"><h3><span>Calibration on new matches</span><span style="text-transform:none;letter-spacing:0">from 1 Oct</span></h3>${cl.length ? cl.map((x) => `<div class="chn"><span>${esc(SHORT[x.lg] || x.lg)} · ${esc(PROP[x.p])}</span><small style="grid-column:span 2;text-align:right">${esc(x.v.verdict || "")}</small></div>`).join("") : `<div class="tempty">Published with the weekly soccer backtest.</div>`}</div>`;
  }

  // --------------------------------------------------------------- Today section
  function today(el) {
    if (!S.slate) { load().then(() => { if (S.slate && document.body.contains(el)) today(el); }); return; }
    if ($("#soccerToday", el)) $("#soccerToday", el).remove();
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const ms = S.slate.matches.filter((m) => { const d = new Date(m.kickoff); return d >= t0 && d - t0 < 864e5 && upcoming(m); });
    if (!ms.length) return;
    css();
    const box = document.createElement("div"); box.id = "soccerToday"; box.className = "tsec";
    box.innerHTML = `<h3><span>⚽ Soccer today · testing</span><button type="button" data-sgo>All matches ›</button></h3>
      ${ms.slice(0, 6).map((m, i) => `<div class="trow" data-stm="${i}" style="cursor:pointer;padding:6px 0">${logoBox(m.home)}<div class="tn">${esc(nm(m.home))} v ${esc(nm(m.away))}<small>${esc(SHORT[m.league] || "")} · ${esc(when(m.kickoff).txt)} · ${esc(ab(m.home))} ${pct(m.proj.p[0])} · draw ${pct(m.proj.p[1])} · ${esc(ab(m.away))} ${pct(m.proj.p[2])}</small></div><div class="pts" style="font-size:20px">${fmt1(m.proj.xg[0])}–${fmt1(m.proj.xg[1])}</div></div>`).join("")}`;
    el.appendChild(box);
    box.onclick = (e) => {
      if (e.target.closest("[data-sgo]")) { const b = document.querySelector('#leagueSeg [data-league="soccer"]'); if (b) b.click(); A.show("games"); return; }
      const r = e.target.closest("[data-stm]"); if (r) openMatch(ms[Number(r.dataset.stm)]);
    };
  }

  // --------------------------------------------------------------- entry
  function render(tab, el) {
    css();
    if (!S.slate) {
      el.innerHTML = `<div class="sk"></div><div class="sk"></div>`;
      load().then(() => (S.slate ? render(tab, el) : (el.innerHTML = `<div class="empty" style="margin-top:14px"><b>No soccer data yet</b>It publishes with the next soccer update.</div>`)));
      return;
    }
    if (tab === "props") renderProps(el);
    else if (tab === "record") renderRecord(el);
    else renderGames(el);
  }
  window.ArcherSoccer = { render, today, reload: () => { S.loading = null; S.slate = null; S.teams = {}; return load(); } };
})();
