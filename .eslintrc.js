module.exports = {
  extends: ['eslint-config-salesforce-typescript', 'plugin:sf-plugin/migration'],
  parserOptions: {
    tsconfigRootDir: __dirname
  },
  root: true,
  rules: {
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
  }
};