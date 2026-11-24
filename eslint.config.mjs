import next from "eslint-config-next";

const config = [...next, { ignores: [".next/**", ".next-e2e/**", ".pglite/**", "node_modules/**"] }];

export default config;
