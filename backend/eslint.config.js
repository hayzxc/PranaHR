import globals from 'globals';
import js from '@eslint/js';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.es2021,
            },
        },
        rules: {
            // Error prevention (keep as warnings for gradual adoption)
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
            'no-undef': 'error',

            // Code style (warnings only for existing codebase)
            'semi': 'warn',
            'quotes': 'off',
            'indent': 'off',
            'comma-dangle': 'off',

            // Best practices
            'eqeqeq': 'warn',
            'curly': 'off',
            'no-var': 'warn',
            'prefer-const': 'warn',
        },
    },
    {
        ignores: ['node_modules/', 'uploads/', 'coverage/'],
    },
];
