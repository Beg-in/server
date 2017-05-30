'use strict';

module.exports =  {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: 'airbnb-base',
  parserOptions: { sourceType: 'script' },
  rules: {
    strict: ['error', 'global'],
    'no-bitwise': ['error', { allow: ['~'] }],
    'func-names': ['warn', 'as-needed'],
    'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
    'prefer-const': 0,
    'arrow-parens': ['error', 'as-needed', { requireForBlockBody: false }],
    'no-plusplus': 0,
    'no-confusing-arrow': 0,
    'no-param-reassign': 0,
    'no-underscore-dangle': ['error', { allow: ['_id'] }],
    'global-require': 0,
    'comma-dangle': ['error', {
      arrays: 'always-multiline',
      objects: 'always-multiline',
      imports: 'always-multiline',
      exports: 'always-multiline',
      functions: 'never',
    }],
    'max-len': ['error', 100, 2, {
      ignoreUrls: true,
      ignoreComments: true,
      ignoreRegExpLiterals: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
    }],
    'global-require': 'error',
    // TODO: remove once async/await is implemented in Node LTS
    'require-yield': 0,
    // 'func-names': 0,
  },
};
