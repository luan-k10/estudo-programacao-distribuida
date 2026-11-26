(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const L = "ABCDE";
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  QUESTOES.forEach((q, i) => { q.id = i; });
  $("#ano").textContent = new Date().getFullYear();

  // ---------------- tema claro/escuro (igual ao portfólio) ----------------
  $("#theme-toggle").addEventListener("click", () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    store.set("theme", next);
  });

  // ---------------- tabelas empilháveis: rótulos para o celular ----------------
  $$("table.stack").forEach(t => {
    const heads = $$("thead th", t).map(th => th.textContent.trim());
    $$("tbody tr", t).forEach(tr => $$("td", tr).forEach((td, i) => td.setAttribute("data-l", heads[i] || "")));
  });

  // ---------------- progresso (localStorage) ----------------
  const KEY = "pdp-progresso-v1";
  let prog = {};
  try { prog = JSON.parse(store.get(KEY)) || {}; } catch { prog = {}; }
  const save = () => store.set(KEY, JSON.stringify(prog));
  const registrar = (q, ok) => { prog[q.id] = ok ? 1 : 0; save(); };

  function renderStats() {
    const ids = Object.keys(prog).filter(k => QUESTOES[k]);
    const certas = ids.filter(k => prog[k] === 1).length;
    $("#st-total").textContent = ids.length;
    $("#st-acerto").textContent = ids.length ? Math.round(certas * 100 / ids.length) + "%" : "0%";
    $("#st-erradas").textContent = ids.length - certas;
    $("#progresso-temas").innerHTML = Object.entries(TEMAS).map(([k, nome]) => {
      const qs = QUESTOES.filter(q => q.t === k);
      const ok = qs.filter(q => prog[q.id] === 1).length;
      const pct = qs.length ? Math.round(ok * 100 / qs.length) : 0;
      return `<div class="prog-row"><span>${esc(nome)}</span><div class="bar"><div style="width:${pct}%"></div></div><span class="muted">${ok}/${qs.length}</span></div>`;
    }).join("");
  }
  $("#btn-reset").addEventListener("click", () => {
    if (confirm("Zerar todo o progresso?")) { prog = {}; save(); renderStats(); renderQuizOptions(); }
  });

  // ---------------- navegação ----------------
  function go(view) {
    if (!$("#view-" + view)) view = "inicio";
    $$("#nav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
    if (view === "inicio") renderStats();
    if (view === "quiz") { $("#quiz-setup").classList.remove("hidden"); $("#quiz-area").classList.add("hidden"); renderQuizOptions(); }
    if (view !== "simulado") clearInterval(simTimer);
    const active = $(`#nav button[data-view="${view}"]`);
    if (active) active.scrollIntoView({ block: "nearest", inline: "center" });
    if (history.replaceState) history.replaceState(null, "", view === "inicio" ? location.pathname : "#" + view);
    window.scrollTo(0, 0);
  }
  $$("#nav button").forEach(b => b.addEventListener("click", () => go(b.dataset.view)));
  $$("[data-go]").forEach(b => b.addEventListener("click", e => {
    e.preventDefault();
    go(b.dataset.go);
    if (b.dataset.lab) openLab(b.dataset.lab);
  }));
  $$(".practice[data-tema]").forEach(b => b.addEventListener("click", () => {
    go("quiz");
    startQuiz(TEMAS[b.dataset.tema], shuffle(QUESTOES.filter(q => q.t === b.dataset.tema)));
  }));

  // Índice de temas: abre o <details> e rola até ele
  $$(".week-index a").forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    const d = $("#" + a.dataset.week);
    d.open = true;
    d.scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  // ---------------- quiz ----------------
  function prep(q, embaralhar) {
    const idx = q.o.map((_, i) => i);
    const ord = embaralhar ? shuffle(idx) : idx;
    return { q, ord, correta: ord.indexOf(q.a) };
  }

  function renderQuizOptions() {
    const erradas = QUESTOES.filter(q => prog[q.id] === 0);
    const nunca = QUESTOES.filter(q => prog[q.id] === undefined);
    const lista1 = QUESTOES.filter(q => q.f.startsWith("Lista"));
    const opts = [
      { nome: "Lista 1 do professor", sub: `${lista1.length} questões objetivas na ordem original`, fn: () => startQuiz("Lista 1", lista1, false) },
      { nome: "Todas misturadas", sub: `${QUESTOES.length} questões`, fn: () => startQuiz("Todas", shuffle(QUESTOES)) },
      { nome: "Ainda não respondidas", sub: `${nunca.length} questões`, fn: () => nunca.length ? startQuiz("Não respondidas", shuffle(nunca)) : alert("Você já respondeu todas!") },
      { nome: "Revisar erradas", sub: `${erradas.length} questões`, fn: () => erradas.length ? startQuiz("Revisão de erradas", shuffle(erradas)) : alert("Nenhuma questão errada para revisar") },
      ...Object.entries(TEMAS).map(([k, nome]) => ({ nome, sub: `${QUESTOES.filter(q => q.t === k).length} questões`, fn: () => startQuiz(nome, shuffle(QUESTOES.filter(q => q.t === k))) })),
    ];
    const box = $("#quiz-options");
    box.innerHTML = "";
    opts.forEach(o => {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = `<b>${esc(o.nome)}</b><small>${esc(o.sub)}</small>`;
      b.addEventListener("click", o.fn);
      box.appendChild(b);
    });
  }

  function startQuiz(titulo, lista, embaralhar = true) {
    const itens = lista.map(q => prep(q, embaralhar));
    let i = 0, acertos = 0;
    const resp = new Array(itens.length).fill(null);
    $("#quiz-setup").classList.add("hidden");
    const area = $("#quiz-area");
    area.classList.remove("hidden");

    function render() {
      const it = itens[i], q = it.q, r = resp[i];
      area.innerHTML = `<div class="card">
        <div class="qhead"><span><b>${esc(titulo)}</b> · ${esc(q.f)}${titulo === TEMAS[q.t] ? "" : " · " + esc(TEMAS[q.t])}</span><span id="q-score">Questão ${i + 1}/${itens.length} · ✓ ${acertos}</span></div>
        <div class="progressline"><div style="width:${(i + 1) * 100 / itens.length}%"></div></div>
        <div class="qtext">${esc(q.q)}</div>
        <div id="opts">${it.ord.map((oi, k) => `<button type="button" class="opt" data-k="${k}"><span class="l">${L[k]})</span><span>${esc(q.o[oi])}</span></button>`).join("")}</div>
        <div id="explic"></div>
        <div class="qnav"><button type="button" class="btn" id="q-prev" ${i === 0 ? "disabled" : ""}>← Anterior</button>
        <button type="button" class="btn" id="q-sair">Sair</button>
        <button type="button" class="btn btn-primary" id="q-next">${i === itens.length - 1 ? "Finalizar" : "Próxima →"}</button></div></div>`;
      if (r !== null) mostrar(r);
      $$("#opts .opt", area).forEach(b => b.addEventListener("click", () => {
        if (resp[i] !== null) return;
        const k = +b.dataset.k;
        resp[i] = k;
        const ok = k === it.correta;
        if (ok) acertos++;
        registrar(q, ok);
        mostrar(k);
        $("#q-score").textContent = `Questão ${i + 1}/${itens.length} · ✓ ${acertos}`;
      }));
      $("#q-prev").onclick = () => { i--; render(); };
      $("#q-next").onclick = () => { if (i < itens.length - 1) { i++; render(); } else fim(); };
      $("#q-sair").onclick = () => go("quiz");
    }
    function mostrar(k) {
      const it = itens[i];
      $$("#opts .opt", area).forEach((b, j) => {
        b.disabled = true;
        if (j === it.correta) b.classList.add("correct");
        else if (j === k) b.classList.add("wrong");
      });
      const ok = k === it.correta;
      $("#explic").innerHTML = `<div class="explic ${ok ? "" : "bad"}"><b>${ok ? "✓ Correto!" : `✗ Resposta certa: ${L[it.correta]}`}</b><br>${esc(it.q.e)}</div>`;
    }
    function fim() {
      const resp_ = resp.filter(r => r !== null).length;
      const pct = resp_ ? Math.round(acertos * 100 / resp_) : 0;
      area.innerHTML = `<div class="card center"><h2>Fim: ${esc(titulo)}</h2>
        <div class="score-big" style="color:${pct >= 70 ? "var(--ok)" : pct >= 50 ? "var(--warn)" : "var(--bad)"}">${pct}%</div>
        <p>${acertos} acertos de ${resp_} respondidas (${itens.length} no total).</p>
        <p class="muted">${pct >= 70 ? "Mandou bem! Tente o simulado." : "Releia os resumos dos temas em que errou e use \"Revisar erradas\"."}</p>
        <button type="button" class="btn btn-primary" id="q-again">Escolher outro conjunto</button></div>`;
      $("#q-again").onclick = () => go("quiz");
    }
    render();
    window.scrollTo(0, 0);
  }

  // ---------------- simulado ----------------
  let simTimer = null;
  $("#sim-start").addEventListener("click", () => {
    const n = +$("#sim-n").value;
    const base = $("#sim-lista").checked ? QUESTOES.filter(q => q.f.startsWith("Lista")) : QUESTOES;
    const itens = shuffle(base).slice(0, n).map(q => prep(q, true));
    const resp = new Array(itens.length).fill(null);
    let i = 0;
    const t0 = Date.now();
    $("#sim-setup").classList.add("hidden");
    const area = $("#sim-area");
    area.classList.remove("hidden");
    const tempo = () => { const s = Math.floor((Date.now() - t0) / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
    clearInterval(simTimer);
    simTimer = setInterval(() => { const el = $("#sim-time"); if (el) el.textContent = tempo(); }, 1000);

    function render() {
      const it = itens[i];
      const respondidas = resp.filter(r => r !== null).length;
      area.innerHTML = `<div class="card">
        <div class="qhead"><span>Simulado · Questão ${i + 1}/${itens.length} · respondidas ${respondidas}</span><span class="timer" id="sim-time">${tempo()}</span></div>
        <div class="progressline"><div style="width:${respondidas * 100 / itens.length}%"></div></div>
        <div class="qtext">${esc(it.q.q)}</div>
        <div id="s-opts">${it.ord.map((oi, k) => `<button type="button" class="opt ${resp[i] === k ? "sel" : ""}" data-k="${k}"><span class="l">${L[k]})</span><span>${esc(it.q.o[oi])}</span></button>`).join("")}</div>
        <div class="qnav"><button type="button" class="btn" id="s-prev" ${i === 0 ? "disabled" : ""}>← Anterior</button>
        <button type="button" class="btn btn-warn" id="s-end">Entregar prova</button>
        <button type="button" class="btn btn-primary" id="s-next" ${i === itens.length - 1 ? "disabled" : ""}>Próxima →</button></div></div>`;
      $$("#s-opts .opt", area).forEach(b => b.addEventListener("click", () => {
        resp[i] = +b.dataset.k;
        if (i < itens.length - 1) { i++; render(); } else render();
      }));
      $("#s-prev").onclick = () => { i--; render(); };
      $("#s-next").onclick = () => { i++; render(); };
      $("#s-end").onclick = () => {
        const falt = resp.filter(r => r === null).length;
        if (falt && !confirm(`Faltam ${falt} questões. Entregar mesmo assim?`)) return;
        fim();
      };
    }
    function fim() {
      clearInterval(simTimer);
      let acertos = 0;
      itens.forEach((it, k) => {
        if (resp[k] === null) return;
        const ok = resp[k] === it.correta;
        if (ok) acertos++;
        registrar(it.q, ok);
      });
      const nota = (acertos * 10 / itens.length).toFixed(1);
      const porTema = {};
      itens.forEach((it, k) => { const t = it.q.t; porTema[t] = porTema[t] || [0, 0]; porTema[t][1]++; if (resp[k] === it.correta) porTema[t][0]++; });
      area.innerHTML = `<div class="card center"><h2>Resultado do simulado</h2>
        <div class="score-big" style="color:${nota >= 7 ? "var(--ok)" : nota >= 5 ? "var(--warn)" : "var(--bad)"}">${nota}</div>
        <p>${acertos}/${itens.length} acertos · tempo ${tempo()}</p>
        <div style="max-width:600px;margin:auto;text-align:left">${Object.entries(porTema).map(([t, [a, n]]) => `<div class="prog-row"><span>${esc(TEMAS[t])}</span><div class="bar"><div style="width:${a * 100 / n}%"></div></div><span class="muted">${a}/${n}</span></div>`).join("")}</div>
        <button type="button" class="btn btn-primary" id="s-new">Novo simulado</button></div>
        <div class="card"><h3 style="margin-top:0">Correção</h3>${itens.map((it, k) => {
          const r = resp[k], ok = r === it.correta;
          return `<div class="review-item"><b class="${ok ? "ok" : "bad"}">${ok ? "✓" : "✗"} ${k + 1}.</b> ${esc(it.q.q)}<br>
            ${r === null ? `<span class="bad">Não respondida.</span> ` : ok ? "" : `<span class="bad">Sua: ${esc(it.q.o[it.ord[r]])}</span><br>`}
            <span class="ok">Certa: ${esc(it.q.o[it.q.a])}</span><br><span class="muted">${esc(it.q.e)}</span></div>`;
        }).join("")}</div>`;
      $("#s-new").onclick = () => { area.classList.add("hidden"); $("#sim-setup").classList.remove("hidden"); };
      window.scrollTo(0, 0);
    }
    render();
  });

  // ---------------- flashcards ----------------
  let cards = [...FLASHCARDS], fi = 0;
  const fc = $("#flashcard");
  function setSide(flip) {
    fc.classList.toggle("flip", flip);
    $("#flash-side").textContent = flip ? "Resposta" : "Pergunta";
  }
  function renderCard() {
    setSide(false);
    $("#flash-front").textContent = cards[fi][0];
    $("#flash-back").innerHTML = cards[fi][1];
    $("#flash-count").textContent = `${fi + 1} / ${cards.length}`;
  }
  fc.addEventListener("click", () => setSide(!fc.classList.contains("flip")));
  fc.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); setSide(!fc.classList.contains("flip")); } });
  $("#flash-prev").onclick = () => { fi = (fi - 1 + cards.length) % cards.length; renderCard(); };
  $("#flash-next").onclick = () => { fi = (fi + 1) % cards.length; renderCard(); };
  $("#flash-shuffle").onclick = () => { cards = shuffle(cards); fi = 0; renderCard(); };
  document.addEventListener("keydown", e => {
    if (!$("#view-flash").classList.contains("active") || /TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === " ") { e.preventDefault(); setSide(!fc.classList.contains("flip")); }
    if (e.key === "ArrowRight") $("#flash-next").click();
    if (e.key === "ArrowLeft") $("#flash-prev").click();
  });
  renderCard();

  // ---------------- discursivas ----------------
  const grupo = d => d.f.split(" – ")[0];
  const grupos = [...new Set(DISCURSIVAS.map(grupo))];
  let discFiltro = "";
  $("#disc-filter").innerHTML = [`<button type="button" data-g="" class="active">Todas (${DISCURSIVAS.length})</button>`,
    ...grupos.map(g => `<button type="button" data-g="${esc(g)}">${esc(g)} (${DISCURSIVAS.filter(d => grupo(d) === g).length})</button>`)].join("");
  $("#disc-list").innerHTML = DISCURSIVAS.map((d, i) => `<div class="card disc" data-g="${esc(grupo(d))}">
    <div class="qhead"><span class="src">${esc(d.f)}</span><span>${esc(TEMAS[d.t] || "")}</span></div>
    <div class="qtext">${esc(d.q)}</div>
    <textarea placeholder="Escreva sua resposta aqui antes de ver o modelo..." data-i="${i}" aria-label="Sua resposta"></textarea>
    <button type="button" class="btn" data-show="${i}">Ver resposta-modelo</button>
    <div class="modelo hidden" id="disc-${i}">${d.r}
      <p><b>Confira se sua resposta tem os pontos-chave:</b></p>
      <div class="chk">${d.k.map(k => `<label><input type="checkbox"> <span>${esc(k)}</span></label>`).join("")}</div></div></div>`).join("");
  $$("#disc-filter button").forEach(b => b.addEventListener("click", () => {
    discFiltro = b.dataset.g;
    $$("#disc-filter button").forEach(x => x.classList.toggle("active", x.dataset.g === discFiltro));
    $$("#disc-list .disc").forEach(c => c.classList.toggle("hidden", !!discFiltro && c.dataset.g !== discFiltro));
  }));
  $$("#disc-list [data-show]").forEach(b => b.addEventListener("click", () => {
    const m = $("#disc-" + b.dataset.show);
    m.classList.toggle("hidden");
    b.textContent = m.classList.contains("hidden") ? "Ver resposta-modelo" : "Esconder resposta-modelo";
  }));
  $$("#disc-list textarea").forEach(t => {
    const k = "pdp-disc-" + t.dataset.i;
    t.value = store.get(k) || "";
    t.addEventListener("input", () => store.set(k, t.value));
  });

  // ---------------- laboratório ----------------
  function openLab(id) {
    $$("#lab-tabs button").forEach(b => b.classList.toggle("active", b.dataset.lab === id));
    $$(".lab").forEach(l => l.classList.toggle("hidden", l.id !== "lab-" + id));
    const b = $(`#lab-tabs button[data-lab="${id}"]`);
    if (b) b.scrollIntoView({ block: "nearest", inline: "center" });
  }
  $$("#lab-tabs button").forEach(b => b.addEventListener("click", () => openLab(b.dataset.lab)));
  const logTo = (el, html) => { const d = document.createElement("div"); d.innerHTML = html; el.appendChild(d); el.scrollTop = el.scrollHeight; };

  // Race condition
  let raceBusy = false;
  $("#race-run").addEventListener("click", async () => {
    if (raceBusy) return; raceBusy = true;
    const lock = $("#race-lock").checked;
    const A = $("#race-a"), B = $("#race-b"), est = $("#race-est"), li = $("#race-lockicon"), vend = $("#race-vend"), res = $("#race-result");
    A.innerHTML = B.innerHTML = ""; res.className = "result";
    let estoque = 10, vendidos = 0;
    const upd = () => { est.textContent = estoque; vend.textContent = "Vendidos: " + vendidos; };
    upd(); li.textContent = "livre";
    const D = 700;
    if (!lock) {
      let a = estoque; logTo(A, `1) leu estoque = <b>${a}</b>`); await sleep(D);
      let b = estoque; logTo(B, `1) leu estoque = <b>${b}</b>`); await sleep(D);
      logTo(A, `2) ${a} ≥ 7 ✔ pode vender`); await sleep(D);
      logTo(B, `2) ${b} ≥ 7 ✔ pode vender`); await sleep(D);
      estoque = a - 7; vendidos += 7; upd(); logTo(A, `3) gravou estoque = ${estoque}`); await sleep(D);
      estoque = b - 7; vendidos += 7; upd(); logTo(B, `3) gravou estoque = ${estoque}`); await sleep(D);
      res.className = "result show bad";
      res.innerHTML = `✗ RACE CONDITION! Foram vendidos <b>${vendidos}</b> itens, mas só existiam 10. As duas threads leram 10 antes de alguém gravar. Estoque final ${estoque} está errado.`;
    } else {
      li.textContent = "em uso"; logTo(A, "Monitor.Enter(obj) — entrou"); logTo(B, "tentou entrar... BLOQUEADA"); await sleep(D);
      let a = estoque; logTo(A, `1) leu estoque = <b>${a}</b>`); await sleep(D);
      logTo(A, `2) ${a} ≥ 7 ✔ pode vender`); await sleep(D);
      estoque = a - 7; vendidos += 7; upd(); logTo(A, `3) gravou estoque = ${estoque}`); await sleep(D);
      logTo(A, "Monitor.Exit(obj)"); li.textContent = "livre"; await sleep(D / 2);
      li.textContent = "em uso"; logTo(B, "entrou na região crítica"); await sleep(D);
      let b = estoque; logTo(B, `1) leu estoque = <b>${b}</b>`); await sleep(D);
      logTo(B, `2) ${b} &lt; 7 ✘ <b>venda recusada</b>`); await sleep(D);
      logTo(B, "Monitor.Exit(obj)"); li.textContent = "livre";
      res.className = "result show ok";
      res.innerHTML = `✓ Correto! Com <code>lock</code>/Monitor só uma thread por vez executa a região crítica. Vendidos ${vendidos}, estoque ${estoque}. B viu o valor atualizado e recusou.`;
    }
    raceBusy = false;
  });

  // Semáforo
  let semN = 3, semQ = [], semIn = [], semId = 0;
  function semRender() {
    $("#sem-nv").textContent = semN;
    $("#sem-count").textContent = `(${semIn.length}/${semN}${semN === 1 ? " — binário = Mutex" : ""})`;
    $("#sem-queue").innerHTML = semQ.map(t => `<div class="tok wait">T${t}</div>`).join("");
    $("#sem-in").innerHTML = semIn.map(t => `<div class="tok in" data-t="${t}" title="Clique para Release()">T${t}</div>`).join("");
    $$("#sem-in .tok").forEach(el => el.addEventListener("click", () => {
      semIn = semIn.filter(x => x !== +el.dataset.t);
      semFill(); semRender();
    }));
    $("#sem-code").textContent = semN === 1
      ? `// N = 1 → semáforo binário, equivalente a um Mutex\nstatic Mutex mutex = new Mutex();\nmutex.WaitOne();   // entra (só 1 por vez)\n// região crítica\nmutex.ReleaseMutex();`
      : `static SemaphoreSlim sem = new SemaphoreSlim(${semN}); // até ${semN} ao mesmo tempo\nsem.Wait();       // contador--  (bloqueia se = 0)\ntry { /* região crítica */ }\nfinally { sem.Release(); } // contador++\n// contador disponível agora: ${semN - semIn.length}`;
  }
  function semFill() { while (semIn.length < semN && semQ.length) semIn.push(semQ.shift()); }
  $("#sem-add").onclick = () => { semQ.push(++semId); semFill(); semRender(); };
  $("#sem-reset").onclick = () => { semQ = []; semIn = []; semId = 0; semRender(); };
  $("#sem-n").oninput = e => {
    semN = +e.target.value;
    while (semIn.length > semN) semQ.unshift(semIn.pop());
    semFill(); semRender();
  };
  semRender();

  // Manual vs AutoResetEvent
  let evSig = false, evWait = [], evPass = [], evId = 0;
  const evMode = () => $("input[name=evmode]:checked").value;
  const evLog = h => logTo($("#ev-log"), h);
  function evRender() {
    $("#ev-wait-list").innerHTML = evWait.map(t => `<div class="tok wait">T${t}</div>`).join("");
    $("#ev-pass-list").innerHTML = evPass.map(t => `<div class="tok in">T${t}</div>`).join("");
    const g = $("#ev-gate");
    g.classList.toggle("open", evSig);
    g.innerHTML = `<span class="ev-dot${evSig ? " on" : ""}"></span><div id="ev-state">${evSig ? "SINALIZADO" : "NÃO SINALIZADO"}</div>`;
  }
  $("#ev-wait").onclick = () => {
    const t = ++evId;
    if (evSig) {
      evPass.push(t);
      if (evMode() === "auto") { evSig = false; evLog(`T${t} WaitOne(): sinal disponível → passou. <b>Auto</b> fechou a porta sozinho.`); }
      else evLog(`T${t} WaitOne(): porta aberta → passou direto (Manual continua aberto).`);
    } else { evWait.push(t); evLog(`T${t} WaitOne(): não sinalizado → <b>bloqueada</b>.`); }
    evRender();
  };
  $("#ev-set").onclick = () => {
    if (evMode() === "manual") {
      evSig = true;
      if (evWait.length) evLog(`Set(): porta aberta → <b>TODAS</b> liberadas (${evWait.map(t => "T" + t).join(", ")}). Continua aberta até Reset().`);
      else evLog("Set(): porta aberta. Quem chegar passa direto até alguém chamar Reset().");
      evPass.push(...evWait); evWait = [];
    } else {
      if (evWait.length) { const t = evWait.shift(); evPass.push(t); evSig = false; evLog(`Set(): liberou <b>só uma</b> thread (T${t}) e fechou automaticamente.`); }
      else if (evSig) evLog("Set(): já estava sinalizado — sinais não acumulam (não é contador como o semáforo).");
      else { evSig = true; evLog("Set(): ninguém esperando → fica sinalizado até a próxima WaitOne()."); }
    }
    evRender();
  };
  $("#ev-reset").onclick = () => {
    evSig = false;
    evLog(evMode() === "manual" ? "Reset(): porta fechada manualmente. Novas WaitOne() vão bloquear." : "Reset(): sinal removido (no Auto quase nunca é necessário — ele fecha sozinho).");
    evRender();
  };
  $("#ev-clear").onclick = () => { evSig = false; evWait = []; evPass = []; evId = 0; $("#ev-log").innerHTML = ""; evRender(); };
  $$("input[name=evmode]").forEach(r => r.addEventListener("change", () => { $("#ev-clear").click(); evLog(`Modo: <b>${evMode() === "manual" ? "ManualResetEvent" : "AutoResetEvent"}</b>`); }));
  evRender();

  // Síncrono vs assíncrono
  let asBusy = false;
  async function asRun(paralelo) {
    if (asBusy) return; asBusy = true;
    const durs = [1, 2, 3], ESC = 1000, TOTAL = 6;
    const bars = $("#as-bars"), ui = $("#as-ui");
    bars.innerHTML = durs.map((d, i) => `<div class="asrow"><span>PIX ${i + 1} (${d}s)</span><div class="astrack"><div class="asbar" id="asb${i}"></div></div></div>`).join("");
    ui.className = "result show " + (paralelo ? "ok" : "bad");
    ui.textContent = paralelo ? "Disparando as 3 tarefas juntas... a interface continua livre." : "Executando uma por vez... (em código bloqueante a UI congelaria)";
    const t0 = performance.now();
    const anima = (i, start) => new Promise(r => {
      const b = $("#asb" + i);
      b.style.left = (start / TOTAL * 100) + "%";
      b.style.transitionDuration = durs[i] + "s";
      requestAnimationFrame(() => requestAnimationFrame(() => { b.style.width = (durs[i] / TOTAL * 100) + "%"; }));
      setTimeout(r, durs[i] * ESC);
    });
    if (paralelo) await Promise.all(durs.map((_, i) => anima(i, 0)));
    else { let s = 0; for (let i = 0; i < durs.length; i++) { await anima(i, s); s += durs[i]; } }
    const t = ((performance.now() - t0) / 1000).toFixed(1);
    ui.innerHTML = paralelo
      ? `✓ <b>Task.WhenAll</b>: total ≈ <b>${t}s</b> (tempo da tarefa mais lenta). As chamadas aconteceram ao mesmo tempo.`
      : `<b>Sequencial</b>: total ≈ <b>${t}s</b> = 1 + 2 + 3. Cada chamada esperou a anterior terminar.`;
    asBusy = false;
  }
  $("#as-sync").onclick = () => asRun(false);
  $("#as-async").onclick = () => asRun(true);

  // Deadlock
  let dlBusy = false;
  $("#dl-run").addEventListener("click", async () => {
    if (dlBusy) return; dlBusy = true;
    const ordem = $("#dl-order").checked;
    const t1 = $("#dl-t1"), t2 = $("#dl-t2"), ra = $("#dl-ra"), rb = $("#dl-rb"), log = $("#dl-log");
    const reset = () => { [t1, t2].forEach(e => e.className = "dl-node"); ra.className = rb.className = "dl-res"; ra.textContent = "Recurso A"; rb.textContent = "Recurso B"; t1.textContent = "Thread 1"; t2.textContent = "Thread 2"; };
    const own = (r, nome, t) => { r.className = "dl-res " + t; r.textContent = `${nome} (${t.toUpperCase()})`; };
    const free = (r, nome) => { r.className = "dl-res"; r.textContent = `${nome}`; };
    reset(); log.innerHTML = "";
    const D = 800;
    if (!ordem) {
      own(ra, "Recurso A", "t1"); logTo(log, "T1: lock(A) ✔"); await sleep(D);
      own(rb, "Recurso B", "t2"); logTo(log, "T2: lock(B) ✔"); await sleep(D);
      t1.className = "dl-node blocked"; t1.textContent = "Thread 1 quer B"; logTo(log, "T1: lock(B)... B está com T2 → <b>esperando</b>"); await sleep(D);
      t2.className = "dl-node blocked"; t2.textContent = "Thread 2 quer A"; logTo(log, "T2: lock(A)... A está com T1 → <b>esperando</b>"); await sleep(D);
      logTo(log, "<b>DEADLOCK</b>: espera circular — nenhuma thread avança, para sempre.");
      logTo(log, "Como evitar: mesma ordem de aquisição, <code>Monitor.TryEnter</code> com timeout, ou menos locks aninhados.");
    } else {
      own(ra, "Recurso A", "t1"); logTo(log, "T1: lock(A) ✔"); await sleep(D);
      t2.className = "dl-node blocked"; t2.textContent = "Thread 2 quer A"; logTo(log, "T2: lock(A)... ocupado → espera (sem pegar B antes!)"); await sleep(D);
      own(rb, "Recurso B", "t1"); logTo(log, "T1: lock(B) ✔ → trabalha"); await sleep(D);
      free(rb, "Recurso B"); free(ra, "Recurso A"); t1.className = "dl-node done"; t1.textContent = "Thread 1 ✔"; logTo(log, "T1: liberou B e A"); await sleep(D);
      t2.className = "dl-node"; t2.textContent = "Thread 2";
      own(ra, "Recurso A", "t2"); logTo(log, "T2: lock(A) ✔"); await sleep(D);
      own(rb, "Recurso B", "t2"); logTo(log, "T2: lock(B) ✔ → trabalha"); await sleep(D);
      free(rb, "Recurso B"); free(ra, "Recurso A"); t2.className = "dl-node done"; t2.textContent = "Thread 2 ✔"; logTo(log, "T2: liberou B e A");
      logTo(log, "✓ Sem deadlock: a ordem fixa (A → B) impede a espera circular.");
    }
    dlBusy = false;
  });

  renderStats();
  renderQuizOptions();
  const h = location.hash.slice(1);
  if (h && $("#view-" + h)) go(h);
  window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if ($("#view-" + v)) go(v); });
})();

// Menu: se não couber numa linha no desktop, passa para 2 linhas; esmaece as bordas quando há itens escondidos.
(() => {
  const bar = document.querySelector(".topbar"), menu = bar && bar.querySelector(".menu");
  if (!menu) return;
  const wide = matchMedia("(min-width: 1000px)");
  const fades = () => {
    const rest = menu.scrollWidth - menu.clientWidth - menu.scrollLeft;
    menu.classList.toggle("fade-l", menu.scrollLeft > 2);
    menu.classList.toggle("fade-r", rest > 2);
  };
  const fit = () => {
    bar.classList.remove("stack");
    if (wide.matches && menu.scrollWidth > menu.clientWidth + 1) bar.classList.add("stack");
    fades();
  };
  menu.addEventListener("scroll", fades, { passive: true });
  addEventListener("resize", fit);
  if (document.fonts) document.fonts.ready.then(fit);
  fit();
})();