const { builtinModules } = require('node:module');

const js = require('@eslint/js');
const globals = require('globals');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            '*.config.js',
            'out/**',
            'test-workspace/**',
            '.vscode-test/**',
        ],
    },
    {
        languageOptions: {
            ecmaVersion: 2022,
            globals: {
                ...globals.es2022,
                ...globals.node,
            },
        },
    },
    js.configs.recommended,
    ...tsPlugin.configs['flat/recommended'],
    {
        files: ['src/**/__mocks__/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.vitest,
            },
        },
    },
    {
        files: ['**/*.ts'],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.eslint.json',
            },
        },
        rules: {
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/explicit-member-accessibility': [
                'error',
                {
                    accessibility: 'explicit',
                    overrides: {
                        constructors: 'no-public',
                        methods: 'explicit',
                        properties: 'explicit',
                        accessors: 'explicit',
                    },
                },
            ],
            '@typescript-eslint/naming-convention': [
                'error',
                { selector: 'import', format: ['camelCase', 'PascalCase'] },
            ],
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    args: 'all',
                },
            ],
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-unused-private-class-members': 'error',
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
            curly: 'warn',
            eqeqeq: 'warn',
            'no-throw-literal': 'warn',
            semi: 'warn',
            'eol-last': ['error', 'always'],
            'no-restricted-imports': [
                'error',
                ...builtinModules
                    .filter(
                        (mod) =>
                            !mod.startsWith('_') && !mod.startsWith('node:'),
                    )
                    .map((mod) => ({
                        name: mod,
                        message: `Use 'node:${mod}' instead.`,
                    })),
            ],
            'no-console': 'error',
        },
    },
    {
        files: ['scripts/**'],
        rules: {
            'no-console': 'off',
        },
    },
];
