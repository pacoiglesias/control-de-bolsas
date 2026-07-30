// ESLint plano (v9). El proyecto no tenía linter, y eso permitió que llegaran
// a producción al menos dos defectos que la regla react-hooks/exhaustive-deps
// habría marcado en el editor.
//
// Deliberadamente NO se engancha a `npm run build`: un error de estilo no debe
// impedir un despliegue urgente. Se corre a mano con `npm run lint`.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'functions/lib', 'node_modules', 'functions/node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Esta es la regla que importa: es la que caza los useMemo/useEffect con
      // dependencias incompletas.
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
