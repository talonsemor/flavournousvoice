module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: "module",
  },
  rules: {
    // keep minimal and non-opinionated to avoid many autofixes
    "no-console": "off",
    "no-unused-vars": ["warn", { "args": "none", "ignoreRestSiblings": true }],
  },
};
