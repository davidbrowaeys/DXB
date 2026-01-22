module.exports = {
  extends: ['eslint-config-salesforce-typescript', 'plugin:sf-plugin/recommended'],
  root: true,
  rules: {
    // --- Disable the errors you are currently seeing ---
    
    'complexity': 'off', // Removes the "Maximum allowed is 20" errors
    '@typescript-eslint/array-type': 'off', // Allows Array<T> instead of forcing T[]
    '@typescript-eslint/no-non-null-assertion': 'off', // Allows the use of the "!" operator
    'class-methods-use-this': 'off', // Allows class methods that don't use 'this'
    'import/order': 'off', // Stops complaining about which import comes first
    'no-await-in-loop': 'off', // Allows await inside loops
    '@typescript-eslint/require-await': 'off', // Allows async functions without an await
    '@typescript-eslint/no-unsafe-return': 'off',
    'spaced-comment': 'off',
    '@typescript-eslint/quotes': 'off',
    'sf-plugin/get-connection-with-version': 'off', 
    'sf-plugin/dash-o': 'off', 
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    'jsdoc/check-indentation': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-inferrable-types':'off',
    '@typescript-eslint/prefer-for-of':'off',
    'no-console': 'off' // Allows console.log statements
  },
};
