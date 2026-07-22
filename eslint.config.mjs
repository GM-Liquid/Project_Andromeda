// eslint.config.mjs     ← копируйте целиком
import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-config-prettier';

export default [
  {
    // Lint only the shipped Foundry system source; Quartz, the rulebook mirror,
    // packs and build output have their own toolchains or are generated.
    ignores: [
      'node_modules/**',
      '.quartz-site/**',
      'packs/**',
      'dist/**',
      'build/**',
      'pip/**',
      '.npm-cache/**',
      'Книга правил v0.4/**'
    ]
  },

  js.configs.recommended,

  {
    // ← наш слой с плагинами/глобалами
    plugins: { import: importPlugin },

    /* !!! ВАЖНО !!! */
    languageOptions: {
      globals: {
        Actor: 'readonly',
        Actors: 'readonly',
        ActorSheet: 'readonly',
        ChatMessage: 'readonly',
        Combat: 'readonly',
        CONFIG: 'readonly',
        CONST: 'readonly',
        structuredClone: 'readonly',
        Dialog: 'readonly',
        Event: 'readonly',
        clearTimeout: 'readonly',
        FormApplication: 'readonly',
        Folder: 'readonly',
        FormData: 'readonly',
        HTMLTextAreaElement: 'readonly',
        Handlebars: 'readonly',
        Hooks: 'readonly',
        Item: 'readonly',
        ItemSheet: 'readonly',
        Items: 'readonly',
        Roll: 'readonly',
        TextEditor: 'readonly',
        console: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        foundry: 'readonly',
        fromUuid: 'readonly',
        game: 'readonly',
        jQuery: 'readonly',
        loadTemplates: 'readonly',
        setTimeout: 'readonly',
        tinymce: 'readonly',
        ui: 'readonly',
        window: 'readonly',
        $: 'readonly'
      }
    },

    rules: {
      'import/no-unresolved': 'off',
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    }
  },

  {
    // Node build tooling (not Foundry runtime code).
    files: ['tools/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly'
      }
    }
  },

  prettier
];
