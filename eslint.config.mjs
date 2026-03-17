// eslint.config.mjs     ← копируйте целиком
import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-config-prettier';

export default [
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
        CONFIG: 'readonly',
        Dialog: 'readonly',
        FormData: 'readonly',
        Handlebars: 'readonly',
        Hooks: 'readonly',
        Item: 'readonly',
        ItemSheet: 'readonly',
        Items: 'readonly',
        Roll: 'readonly',
        console: 'readonly',
        document: 'readonly',
        foundry: 'readonly',
        game: 'readonly',
        loadTemplates: 'readonly',
        setTimeout: 'readonly',
        tinymce: 'readonly',
        ui: 'readonly',
        $: 'readonly'
      }
    },

    rules: {
      'import/no-unresolved': 'off'
    }
  },

  prettier
];
