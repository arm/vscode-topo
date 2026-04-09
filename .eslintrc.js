module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: ['eslint:recommended'],
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './tsconfig.eslint.json',
      },
      plugins: ['@typescript-eslint', 'react', 'react-hooks'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
      ],
      rules: {
        // TypeScript rules
        '@typescript-eslint/naming-convention': [
          'error',
          { selector: 'import', format: ['camelCase', 'PascalCase'] },
        ],
        'indent': ['error', 4],
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_', 
            args: "all",
          },
        ],
        '@typescript-eslint/no-explicit-any': 'error',

        // General best practices
        curly: 'warn',
        eqeqeq: 'warn',
        'no-throw-literal': 'warn',
        semi: 'warn',
        'no-multiple-empty-lines': ['error', { max: 1 }],
        'eol-last': ['error', 'always'],

        // React rules
        'react/jsx-uses-react': 'off', // not needed with React 17+
        'react/react-in-jsx-scope': 'off', // not needed with React 17+
        'react/prop-types': 'off', // not used with TypeScript
      },
      settings: {
        react: {
          version: 'detect',
        },
      },
    },
  ],
};
