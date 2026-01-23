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

                curly: 'warn',
                eqeqeq: 'warn',
                'no-throw-literal': 'warn',
                semi: 'warn',
                'eol-last': ['error', 'always'],
                'react/jsx-uses-react': 'off',
                'react/react-in-jsx-scope': 'off',
                'react/prop-types': 'off',
                'no-console': 'error',
            },
            settings: {
                react: {
                    version: 'detect',
                },
            },
        },
        {
            files: ['scripts/**', 'media/**'],
            rules: {
                'no-console': 'off',
            },
        },
    ],
};
