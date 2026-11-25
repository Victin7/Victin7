// Gera as imagens dinâmicas do perfil (aranha, estatísticas, linguagens)
// e atualiza a seção "Agora" do README. Roda todo dia pela GitHub Action.
// Uso local de teste: DADOS_TESTE=caminho.json node scripts/gerar-perfil.mjs
import { readFileSync, writeFileSync } from "node:fs";

const USUARIO = process.env.USUARIO || "Victin7";
const TOKEN = process.env.GITHUB_TOKEN || "";
const ANO = new Date().getUTCFullYear();

const AZUL = ["#161b22", "#0b3a75", "#1559b8", "#1f7bff", "#7cc4ff"];
const COR_LING = { TypeScript: "#4da3ff", HTML: "#1f7bff", JavaScript: "#9fd3ff", CSS: "#5b6cff", Python: "#7cc4ff", PLpgSQL: "#2f5fa8" };

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => n.toLocaleString("pt-BR");

async function api(caminho) {
  const r = await fetch("https://api.github.com" + caminho, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "perfil-" + USUARIO, ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}) },
  });
  if (!r.ok) throw new Error(caminho + " -> " + r.status);
  return r.json();
}

async function contribuicoes() {
  const r = await fetch(`https://github.com/users/${USUARIO}/contributions?from=${ANO}-01-01&to=${ANO}-12-31`, { headers: { "User-Agent": "perfil-" + USUARIO } });
  const html = await r.text();
  const dicas = {};
  for (const m of html.matchAll(/<tool-tip[^>]*for="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) dicas[m[1]] = m[2].trim();
  const dias = [];
  for (const m of html.matchAll(/<td[^>]*?data-date="(\d{4}-\d{2}-\d{2})"[^>]*?id="([^"]+)"[^>]*?data-level="(\d)"/g)) {
    const t = dicas[m[2]] || "";
    const n = /^(\d+)/.test(t) ? +t.match(/^(\d+)/)[1] : 0;
    dias.push({ data: m[1], n, nivel: +m[3] });
  }
  // atributos podem vir em outra ordem
  if (!dias.length) {
    for (const m of html.matchAll(/<td([^>]*ContributionCalendar-day[^>]*)>/g)) {
      const a = m[1], d = a.match(/data-date="([^"]+)"/), id = a.match(/id="([^"]+)"/), lv = a.match(/data-level="(\d)"/);
      if (!d) continue;
      const t = (id && dicas[id[1]]) || "";
      dias.push({ data: d[1], n: /^(\d+)/.test(t) ? +t.match(/^(\d+)/)[1] : 0, nivel: lv ? +lv[1] : 0 });
    }
  }
  dias.sort((a, b) => a.data.localeCompare(b.data));
  return dias;
}

async function repositorios() {
  const repos = await api(`/users/${USUARIO}/repos?per_page=100&type=owner&sort=pushed`);
  const usuario = await api(`/users/${USUARIO}`);
  const ling = {};
  for (const r of repos.filter((r) => !r.fork)) {
    try { for (const [k, v] of Object.entries(await api(`/repos/${USUARIO}/${r.name}/languages`))) ling[k] = (ling[k] || 0) + v; } catch {}
  }
  return { repos, usuario, ling };
}

// ---------- aranha ----------
function svgAranha(dias) {
  const C = 12, G = 3, X0 = 34, Y0 = 70, hoje = new Date().toISOString().slice(0, 10);
  const primeiro = new Date(dias[0].data + "T00:00:00Z").getUTCDay();
  const celulas = dias.map((d, i) => ({ ...d, col: Math.floor((i + primeiro) / 7), lin: (i + primeiro) % 7 }));
  const cols = Math.max(...celulas.map((c) => c.col)) + 1;
  const W = Math.max(860, X0 * 2 + cols * (C + G)), H = 210;
  const cx = (c) => X0 + c.col * (C + G) + C / 2, cy = (c) => Y0 + c.lin * (C + G) + C / 2;
  const total = dias.reduce((s, d) => s + d.n, 0);

  // alvos: dias mais fortes, até 10, em ordem da esquerda para a direita
  const alvos = celulas.filter((c) => c.n > 0).sort((a, b) => b.n - a.n).slice(0, 10).sort((a, b) => a.col - b.col || a.lin - b.lin);
  const PASSO = 1.7, T = alvos.length * PASSO + 3;
  const yFio = 34;
  // posições da aranha: começa fora à esquerda, para acima de cada alvo, sai pela direita
  const xs = [-30, ...alvos.map(cx), W + 30];
  const kt = [0], kx = [xs[0]];
  alvos.forEach((a, i) => { const t0 = 1 + i * PASSO; kt.push(t0 / T, (t0 + PASSO * 0.55) / T); kx.push(xs[i + 1], xs[i + 1]); });
  kt.push((T - 1) / T, 1); kx.push(W + 30, W + 30);
  // garante tempos crescentes: o movimento acontece entre o fim de uma parada e o início da próxima
  const pares = []; for (let i = 0; i < kt.length; i++) pares.push([kt[i], kx[i]]);
  const kts = pares.map((p) => p[0].toFixed(4)).join(";"), kxs = pares.map((p) => `${p[1].toFixed(1)} 0`).join(";");

  const cel = celulas.map((c) => `<rect x="${X0 + c.col * (C + G)}" y="${Y0 + c.lin * (C + G)}" width="${C}" height="${C}" rx="2.5" fill="${c.data > hoje ? "#0d1117" : AZUL[c.nivel]}"/>`).join("");

  const teias = alvos.map((a, i) => {
    const t0 = 1 + i * PASSO, ini = (t0 + 0.15) / T, fim = (t0 + 0.55) / T, x = cx(a), y = cy(a), sy = yFio + 30;
    const L = Math.hypot(0, y - sy).toFixed(1);
    const raios = [0, 45, 90, 135].map((ang) => { const r = 9, dx = Math.cos(ang * Math.PI / 180) * r, dy = Math.sin(ang * Math.PI / 180) * r; return `M${(x - dx).toFixed(1)} ${(y - dy).toFixed(1)}L${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}`; }).join("");
    const aneis = [4, 7.5].map((r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none"/>`).join("");
    return `
  <g>
    <line x1="${x}" y1="${sy}" x2="${x}" y2="${y}" stroke="#cfe8ff" stroke-width="1" stroke-dasharray="${L}" stroke-dashoffset="${L}" opacity=".9">
      <animate attributeName="stroke-dashoffset" values="${L};${L};0;0;${L}" keyTimes="0;${ini.toFixed(4)};${fim.toFixed(4)};${((T - 0.6) / T).toFixed(4)};1" dur="${T}s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0;0;.9;.35;.35;0" keyTimes="0;${ini.toFixed(4)};${fim.toFixed(4)};${Math.min(.97, fim + 0.06).toFixed(4)};${((T - 0.6) / T).toFixed(4)};1" dur="${T}s" repeatCount="indefinite"/>
    </line>
    <g stroke="#cfe8ff" stroke-width=".7" opacity="0">
      <path d="${raios}"/>${aneis}
      <animate attributeName="opacity" values="0;0;1;.75;.75;0" keyTimes="0;${fim.toFixed(4)};${Math.min(.99, fim + 0.02).toFixed(4)};${Math.min(.99, fim + 0.08).toFixed(4)};${((T - 0.6) / T).toFixed(4)};1" dur="${T}s" repeatCount="indefinite"/>
    </g>
    <rect x="${x - C / 2 - 1.5}" y="${y - C / 2 - 1.5}" width="${C + 3}" height="${C + 3}" rx="3" fill="#cfe8ff" opacity="0" filter="url(#brilho)">
      <animate attributeName="opacity" values="0;0;.95;.25;.25;0" keyTimes="0;${fim.toFixed(4)};${Math.min(.99, fim + 0.02).toFixed(4)};${Math.min(.99, fim + 0.1).toFixed(4)};${((T - 0.6) / T).toFixed(4)};1" dur="${T}s" repeatCount="indefinite"/>
    </rect>
  </g>`;
  }).join("");

  // aranha (desenho próprio): corpo, 8 pernas, olhos azuis
  const perna = (s, p) => `<path d="M0 ${p[0]} Q ${s * p[1]} ${p[2]} ${s * p[3]} ${p[4]}"/>`;
  const P = [[-2, 12, -10, 18, -2], [0, 13, -3, 19, 6], [2, 12, 4, 17, 13], [3, 9, 9, 12, 18]];
  const corpoPernas = [-1, 1].map((s) => P.map((p) => perna(s, p)).join("")).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="brilho" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>
    <filter id="olho" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="${W}" height="${H}" rx="12" fill="#0d1117"/>
  <text x="${X0}" y="24" font-family="JetBrains Mono,Consolas,monospace" font-size="12" fill="#8b949e">// ${fmt(total)} contribuições em ${ANO} · a aranha marca os dias mais fortes</text>
  <line x1="0" y1="${yFio}" x2="${W}" y2="${yFio}" stroke="#30363d" stroke-width="1"/>
  ${cel}
  ${teias}
  <g>
    <animateTransform attributeName="transform" type="translate" values="${kxs}" keyTimes="${kts}" dur="${T}s" calcMode="spline" keySplines="${pares.slice(1).map(() => ".45 0 .55 1").join(";")}" repeatCount="indefinite"/>
    <line x1="0" y1="${yFio}" x2="0" y2="${yFio + 22}" stroke="#cfe8ff" stroke-width=".8" opacity=".7"/>
    <g transform="translate(0 ${yFio + 30})">
      <animateTransform attributeName="transform" type="translate" values="0 ${yFio + 28};0 ${yFio + 32};0 ${yFio + 28}" dur="1.4s" repeatCount="indefinite"/>
      <g fill="none" stroke="#9fb4d0" stroke-width="1.3" stroke-linecap="round">${corpoPernas}</g>
      <ellipse cx="0" cy="-7" rx="6.5" ry="8" fill="#1c2b44" stroke="#4da3ff" stroke-width="1"/>
      <ellipse cx="0" cy="5" rx="5" ry="5.5" fill="#22344f" stroke="#4da3ff" stroke-width="1"/>
      <path d="M-2.2 -10 L0 -5 L2.2 -10" fill="none" stroke="#4da3ff" stroke-width=".9"/>
      <circle cx="-2" cy="7" r="1.3" fill="#7cc4ff" filter="url(#olho)"/><circle cx="2" cy="7" r="1.3" fill="#7cc4ff" filter="url(#olho)"/>
    </g>
  </g>
  <g font-family="JetBrains Mono,Consolas,monospace" font-size="11" fill="#8b949e">
    <text x="${W - X0 - 120}" y="${H - 18}" text-anchor="end">menos</text>
    ${AZUL.map((c, i) => `<rect x="${W - X0 - 114 + i * 16}" y="${H - 28}" width="11" height="11" rx="2" fill="${c}"/>`).join("")}
    <text x="${W - X0}" y="${H - 18}" text-anchor="end">mais</text>
  </g>
</svg>`;
}

// ---------- estatísticas ----------
function cartao(titulo, corpo, h) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="${h}" viewBox="0 0 420 ${h}">
  <defs><linearGradient id="l" x1="0" x2="1"><stop offset="0" stop-color="#1f7bff"/><stop offset="1" stop-color="#9fd3ff"/></linearGradient></defs>
  <rect x=".5" y=".5" width="419" height="${h - 1}" rx="12" fill="#0d1117" stroke="#1f3a63"/>
  <text x="22" y="34" font-family="Segoe UI,Inter,Arial,sans-serif" font-weight="700" font-size="16" fill="#e6edf3">${esc(titulo)}</text>
  <rect x="22" y="44" width="40" height="2" rx="1" fill="url(#l)"/>
  ${corpo}
</svg>`;
}
function svgStats({ total, ativos, publicos, estrelas, seguidores, maiorDia }) {
  const linhas = [["Contribuições em " + ANO, fmt(total)], ["Dias com commit", fmt(ativos)], ["Repositórios públicos", fmt(publicos)], ["Maior dia", maiorDia], ["Estrelas · seguidores", `${estrelas} · ${seguidores}`]];
  const corpo = linhas.map(([k, v], i) => `<text x="22" y="${78 + i * 26}" font-family="JetBrains Mono,Consolas,monospace" font-size="13" fill="#8b949e">${esc(k)}</text><text x="398" y="${78 + i * 26}" text-anchor="end" font-family="JetBrains Mono,Consolas,monospace" font-size="13" font-weight="700" fill="#cfe8ff">${esc(v)}</text>`).join("");
  return cartao("Em números", corpo, 200);
}
function svgLing(ling) {
  const tot = Object.values(ling).reduce((a, b) => a + b, 0) || 1;
  const top = Object.entries(ling).sort((a, b) => b[1] - a[1]).slice(0, 5);
  let x = 22; const barra = top.map(([k, v]) => { const w = Math.max(2, (v / tot) * 376); const r = `<rect x="${x.toFixed(1)}" y="64" width="${w.toFixed(1)}" height="10" fill="${COR_LING[k] || "#3b6fb6"}"/>`; x += w; return r; }).join("");
  const itens = top.map(([k, v], i) => `<circle cx="${30 + (i % 2) * 190}" cy="${100 + Math.floor(i / 2) * 26}" r="5" fill="${COR_LING[k] || "#3b6fb6"}"/><text x="${42 + (i % 2) * 190}" y="${104 + Math.floor(i / 2) * 26}" font-family="JetBrains Mono,Consolas,monospace" font-size="13" fill="#c9d1d9">${esc(k)} <tspan fill="#8b949e">${((v / tot) * 100).toFixed(1).replace(".", ",")}%</tspan></text>`).join("");
  return cartao("Linguagens", `<clipPath id="b"><rect x="22" y="64" width="376" height="10" rx="5"/></clipPath><g clip-path="url(#b)">${barra}</g>${itens}`, 200);
}

function secaoAgora(repos) {
  const hoje = Date.now();
  const quando = (d) => { const dias = Math.floor((hoje - new Date(d).getTime()) / 864e5); return dias <= 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias`; };
  const lista = repos.filter((r) => !r.fork && r.name !== USUARIO).slice(0, 4)
    .map((r) => `- **[${r.name}](${r.html_url})**: ${r.description ? r.description.replace(/\s+$/, "") : "sem descrição"} · <sub>atualizado ${quando(r.pushed_at)}</sub>`).join("\n");
  return `<!--AGORA:INICIO-->\n${lista}\n<!--AGORA:FIM-->`;
}

// ---------- principal ----------
const teste = process.env.DADOS_TESTE ? JSON.parse(readFileSync(process.env.DADOS_TESTE, "utf8")) : null;
const dias = teste ? teste.dias : await contribuicoes();
if (!dias.length) throw new Error("não consegui ler as contribuições");
const { repos, usuario, ling } = teste ? teste : await repositorios();

const total = dias.reduce((s, d) => s + d.n, 0);
const forte = dias.reduce((m, d) => (d.n > m.n ? d : m), { n: 0, data: "" });
const maiorDia = forte.n ? `${forte.n} em ${forte.data.slice(8, 10)}/${forte.data.slice(5, 7)}` : "—";
writeFileSync("assets/aranha.svg", svgAranha(dias));
writeFileSync("assets/stats.svg", svgStats({ total, ativos: dias.filter((d) => d.n > 0).length, publicos: usuario.public_repos, estrelas: repos.reduce((s, r) => s + (r.fork ? 0 : r.stargazers_count), 0), seguidores: usuario.followers, maiorDia }));
writeFileSync("assets/linguagens.svg", svgLing(ling));
const readme = readFileSync("README.md", "utf8");
writeFileSync("README.md", readme.replace(/<!--AGORA:INICIO-->[\s\S]*?<!--AGORA:FIM-->/, secaoAgora(repos)));
console.log("ok", total, "contribuições");
