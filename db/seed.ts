// Cria o 1.º GAE_ADMIN, um FENT_OBSERVER e a estrutura académica inicial.
// Uso: npm run db:seed   (lê DATABASE_URL e credenciais de .env.local)
// As credenciais NUNCA ficam no código: vêm de variáveis de ambiente.
import postgres from "postgres";
import { hashPassword } from "../lib/password.ts";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável ${name} em falta.`);
  return v;
}

function strongEnough(p: string) {
  return p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
}

const url = required("DATABASE_URL");
const adminId = required("SEED_ADMIN_IDENTIFICADOR");
const adminNome = process.env.SEED_ADMIN_NOME ?? "Administrador GAE";
const adminPass = required("SEED_ADMIN_PASSWORD");
const obsId = required("SEED_OBSERVER_IDENTIFICADOR");
const obsNome = process.env.SEED_OBSERVER_NOME ?? "Observador FENT Fest";
const obsPass = required("SEED_OBSERVER_PASSWORD");

for (const p of [adminPass, obsPass]) {
  if (!strongEnough(p)) throw new Error("Palavras-passe iniciais: mínimo 8 caracteres com letras e números.");
}

const sql = postgres(url, { ssl: "require", max: 1 });

try {
  await sql.begin(async (tx) => {
    // Estrutura mínima. O GAE completa o resto em /gae/estrutura.
    const [fac] = await tx`
      INSERT INTO faculdades (nome, sigla)
      VALUES ('Faculdade de Engenharia e Novas Tecnologias', 'FENT')
      ON CONFLICT (sigla) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id`;
    await tx`
      INSERT INTO cursos (faculdade_id, nome, codigo)
      VALUES (${fac.id}, 'Engenharia Informática', 'EI')
      ON CONFLICT (codigo) DO NOTHING`;

    const adminHash = await hashPassword(adminPass);
    const [admin] = await tx`
      INSERT INTO utilizadores (nome_completo, identificador, password_hash, role)
      VALUES (${adminNome}, ${adminId.trim().toLowerCase()}, ${adminHash}, 'GAE_ADMIN')
      ON CONFLICT (identificador) DO NOTHING
      RETURNING id`;

    const obsHash = await hashPassword(obsPass);
    await tx`
      INSERT INTO utilizadores (nome_completo, identificador, password_hash, role, criado_por)
      VALUES (${obsNome}, ${obsId.trim().toLowerCase()}, ${obsHash}, 'FENT_OBSERVER', ${admin?.id ?? null})
      ON CONFLICT (identificador) DO NOTHING`;
  });
  console.log("Seed concluído.");
} finally {
  await sql.end();
}
