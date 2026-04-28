const { builtinModules } = require('module');

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
            files: ['**/*.ts'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                project: './tsconfig.eslint.json',
            },
            plugins: ['@typescript-eslint'],
            extends: ['plugin:@typescript-eslint/recommended'],
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
                'no-unused-vars': 'off',
                '@typescript-eslint/no-unused-vars': [
                    'error',
                    {
                        argsIgnorePattern: '^_',
                        varsIgnorePattern: '^_',
                        args: 'all',
                    },
                ],
                '@typescript-eslint/no-unused-private-class-members': 'error',
                '@typescript-eslint/no-explicit-any': 'error',
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
                                !mod.startsWith('_') &&
                                !mod.startsWith('node:'),
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
    ],
};
