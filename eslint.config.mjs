import next from "eslint-config-next";

const config = [...next, { ignores: [".next/**", ".next-e2e/**", ".next-build/**", ".pglite/**", "node_modules/**"] }];

export default config;
