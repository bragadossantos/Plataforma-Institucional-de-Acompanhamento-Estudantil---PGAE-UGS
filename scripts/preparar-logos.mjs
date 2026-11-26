// Gera os logótipos da plataforma a partir dos originais em design/logos-originais/.
// Uso: node scripts/preparar-logos.mjs
// - remove o fundo branco (só o que está ligado à margem, para não apagar o branco do emblema);
// - suaviza as margens sem deixar halo branco; corta o excesso; exporta PNG com transparência.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ORIGINAL = fileURLToPath(new URL("../design/logos-originais/ugs-logo-completo.png", import.meta.url));
const LIMIAR = 236; // canais acima disto contam como "branco"
const LINHA_TEXTO = 700; // abaixo desta linha só há texto escuro: qualquer branco é fundo

async function semFundo(entrada, { brancoGlobalAPartirDe = Infinity } = {}) {
  const { data, info } = await sharp(entrada).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = new Uint8ClampedArray(data);
  const idx = (x, y) => (y * w + x) * 4;
  const branco = (i) => px[i] >= LIMIAR && px[i + 1] >= LIMIAR && px[i + 2] >= LIMIAR;
  const fundo = new Uint8Array(w * h);

  // Preenchimento a partir da margem
  const fila = [];
  const semear = (x, y) => {
    const k = y * w + x;
    if (!fundo[k] && branco(idx(x, y))) {
      fundo[k] = 1;
      fila.push(k);
    }
  };
  for (let x = 0; x < w; x++) { semear(x, 0); semear(x, h - 1); }
  for (let y = 0; y < h; y++) { semear(0, y); semear(w - 1, y); }
  while (fila.length) {
    const k = fila.pop();
    const x = k % w, y = (k - x) / w;
    if (x > 0) semear(x - 1, y);
    if (x < w - 1) semear(x + 1, y);
    if (y > 0) semear(x, y - 1);
    if (y < h - 1) semear(x, y + 1);
  }
  // Zona só de texto: o branco dentro das letras também é fundo
  for (let y = brancoGlobalAPartirDe; y < h; y++) for (let x = 0; x < w; x++) if (branco(idx(x, y))) fundo[y * w + x] = 1;

  const vizinhoFundo = (x, y) =>
    (x > 0 && fundo[y * w + x - 1]) || (x < w - 1 && fundo[y * w + x + 1]) || (y > 0 && fundo[(y - 1) * w + x]) || (y < h - 1 && fundo[(y + 1) * w + x]);

  const saida = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y), o = i;
      if (fundo[y * w + x]) continue; // transparente (0,0,0,0)
      let [r, g, b] = [px[i], px[i + 1], px[i + 2]];
      let a = 255;
      if (vizinhoFundo(x, y)) {
        // margem: o pixel é uma mistura com o branco. Estima a opacidade e retira o branco.
        const m = Math.min(r, g, b);
        a = Math.max(0, Math.min(255, Math.round(((255 - m) / (255 - 190)) * 255)));
        if (a > 0 && a < 255) {
          const f = a / 255;
          r = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - f)) / f)));
          g = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - f)) / f)));
          b = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - f)) / f)));
        }
      }
      saida[o] = r; saida[o + 1] = g; saida[o + 2] = b; saida[o + 3] = a;
    }
  }
  return sharp(saida, { raw: { width: w, height: h, channels: 4 } });
}

mkdirSync(new URL("../public/brand/", import.meta.url), { recursive: true });
const pub = (f) => fileURLToPath(new URL(`../public/brand/${f}`, import.meta.url));
const app = (f) => fileURLToPath(new URL(`../app/${f}`, import.meta.url));

// 1) Logótipo completo (emblema + nome), com transparência
const completo = (await semFundo(ORIGINAL, { brancoGlobalAPartirDe: LINHA_TEXTO })).trim();
await completo.clone().resize({ width: 720 }).png({ compressionLevel: 9 }).toFile(pub("ugs-logo.png"));

// 2) Emblema (parte de cima do logótipo completo, com a maior resolução disponível)
const topo = await sharp(ORIGINAL).extract({ left: 0, top: 0, width: 960, height: LINHA_TEXTO - 30 }).toBuffer();
const emblema = (await semFundo(topo)).trim();
const emblemaBuf = await emblema.clone().resize({ width: 512, height: 512, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(pub("ugs-emblema.png"), emblemaBuf);

// 3) Ícones do browser (convenção do Next: app/icon.png e app/apple-icon.png)
await sharp(emblemaBuf).resize(256, 256).png({ compressionLevel: 9 }).toFile(app("icon.png"));
// O ícone da iOS não admite transparência: assenta o emblema num fundo creme.
await sharp(emblemaBuf).resize(150, 150).extend({ top: 15, bottom: 15, left: 15, right: 15, background: "#F4F2EC" }).flatten({ background: "#F4F2EC" }).png({ compressionLevel: 9 }).toFile(app("apple-icon.png"));

// 4) Emblema pequeno em base64 para o cabeçalho do PDF (funciona na Vercel sem depender de ficheiros)
const pdf = await sharp(emblemaBuf).resize(160, 160).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
writeFileSync(
  fileURLToPath(new URL("../lib/brand-data.ts", import.meta.url)),
  `// Gerado por scripts/preparar-logos.mjs. Não editar à mão.\n// Emblema da UGS (PNG 160×160, transparente) em base64, para o cabeçalho do relatório PDF.\nexport const EMBLEMA_PNG_BASE64 = "${pdf.toString("base64")}";\n`,
);

const m1 = await sharp(pub("ugs-logo.png")).metadata();
const m2 = await sharp(pub("ugs-emblema.png")).metadata();
console.log(`ugs-logo.png ${m1.width}×${m1.height} · ugs-emblema.png ${m2.width}×${m2.height} · pdf ${pdf.length} bytes`);
