// Verifica que nenhum segredo nem código de servidor foi para o bundle do browser.
// Uso: npm run verificar:bundle [pasta-do-build]   (por defeito .next-build; corre-se depois de `next build`)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const pasta = process.argv[2] ?? ".next-build";
const estaticos = join(pasta, "static");

function* ficheiros(dir) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) yield* ficheiros(p);
    else yield p;
  }
}

// 1) Valores reais dos segredos (se estiverem definidos no ambiente) e padrões que nunca devem estar no cliente.
const segredos = ["SESSION_SECRET", "VOTE_PEPPER", "IP_SALT", "DATABASE_URL"]
  .map((k) => [k, process.env[k]])
  .filter(([, v]) => v && v.length >= 8);

const padroes = [
  ["nome da variável SESSION_SECRET", /SESSION_SECRET/],
  ["nome da variável VOTE_PEPPER", /VOTE_PEPPER/],
  ["nome da variável IP_SALT", /IP_SALT/],
  ["nome da variável DATABASE_URL", /DATABASE_URL/],
  ["cadeia de ligação Postgres", /postgres(ql)?:\/\/[^\s"'`]+@/],
  ["scrypt (código de servidor)", /\bscrypt\b/],
  ["createHmac (código de servidor)", /createHmac/],
  ["extensão .map exposta", /sourceMappingURL=.*\.map/],
];

let total = 0;
const achados = [];
for (const f of ficheiros(estaticos)) {
  if (!/\.(js|css|html|json|map)$/.test(f)) continue;
  total++;
  const txt = readFileSync(f, "utf8");
  for (const [nome, valor] of segredos) if (txt.includes(valor)) achados.push(`${f}: contém o VALOR de ${nome}`);
  for (const [nome, re] of padroes) if (re.test(txt)) achados.push(`${f}: ${nome}`);
}

if (total === 0) {
  console.error(`Nada para verificar em ${estaticos}. Corra primeiro o build.`);
  process.exit(2);
}
if (achados.length) {
  console.error(`✖ ${achados.length} problema(s) no bundle do browser:\n- ${achados.join("\n- ")}`);
  process.exit(1);
}
console.log(`✔ ${total} ficheiros do bundle do browser verificados: sem segredos nem código de servidor.`);
