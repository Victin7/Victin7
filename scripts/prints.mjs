// Tira prints dos sites dos projetos para os cartões do README.
import { chromium } from "playwright";
const SITES = {
  colevo: "https://victin7.github.io/Colevo/",
  "europa-manutencao": "https://victin7.github.io/europa-manutencao/",
  platto: "https://platto-a.vercel.app",
  nexo: "https://nexo-eight-psi.vercel.app",
  "victin-studio": "https://victin-studio.vercel.app",
};
const nav = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const [nome, url] of Object.entries(SITES)) {
  const pg = await nav.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, colorScheme: "dark" });
  try {
    await pg.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await pg.waitForTimeout(nome === "victin-studio" ? 6000 : 2500);
    await pg.screenshot({ path: `assets/projetos/${nome}.jpg`, type: "jpeg", quality: 80 });
    console.log("ok", nome);
  } catch (e) { console.log("falhou", nome, e.message); }
  await pg.close();
}
await nav.close();
