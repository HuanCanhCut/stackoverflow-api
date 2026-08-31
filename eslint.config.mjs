import eslintPluginPrettier from 'eslint-plugin-prettier'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'
import tseslint from 'typescript-eslint'

import pluginJs from '@eslint/js'

export default [
    {
        ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'src/generated/**'],
    },

    pluginJs.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
        files: ['**/*.ts'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            prettier: eslintPluginPrettier,
            'simple-import-sort': simpleImportSort,
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            '@typescript-eslint/no-floating-promises': 'warn',
            '@typescript-eslint/no-misused-promises': 'warn',
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unsafe-declaration-merging': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',

            'prettier/prettier': [
                'warn',
                {
                    tabWidth: 4,
                    printWidth: 120,
                    semi: false,
                    singleQuote: true,
                    arrowParens: 'always',
                    endOfLine: 'auto',
                },
            ],
            'simple-import-sort/imports': [
                'warn',
                {
                    groups: [
                        // Node builtin
                        ['^node:'],
                        // Package
                        ['^@?\\w'],
                        // Absolute/internal alias nếu sau này dùng @/
                        ['^@/'],
                        // Relative imports
                        ['^\\.'],
                    ],
                },
            ],
            'simple-import-sort/exports': 'warn',
        },
    },
]
