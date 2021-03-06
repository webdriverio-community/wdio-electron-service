module.exports = {
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
    'prettier',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/errors',
    'plugin:import/typescript',
    'plugin:import/warnings',
    'plugin:n/recommended',
    'plugin:jest/recommended',
    'plugin:jest/style',
    'plugin:wdio/recommended',
  ],
  plugins: ['@typescript-eslint', 'import', 'n', 'jest', 'wdio'],
  env: {
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: [`${__dirname}/tsconfig.json`],
        alwaysTryTypes: true,
      },
    },
  },
  // rules re-declared here because the "extends" above nukes the inherited ones
  rules: {
    'no-unused-vars': 'off',
    'import/prefer-default-export': 'off',
    'n/no-missing-import': 'off', // duped by import
    'n/no-unpublished-import': 'error',
    'n/no-unsupported-features/es-syntax': ['error', { ignores: ['modules'] }],
    'import/no-extraneous-dependencies': 'off',
    'n/no-extraneous-import': 'off',
    'n/no-extraneous-require': 'off',
    'n/no-unpublished-require': 'off',
    '@typescript-eslint/unbound-method': 'off',
    'jest/unbound-method': 'error',
  },
};
