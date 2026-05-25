import { Schema } from 'ajv';

export const cardDetailSchema: Schema = {
  type: 'object',
  required: [
    'support_id',
    'char_name',
    'title',
    'card_type',
    'rarity',
    'is_welfare',
    'release_date',
    'is_predicted_date',
    'unique_effect',
    'effects',
    'skills',
  ],
  additionalProperties: false,
  properties: {
    support_id: { type: 'integer' },
    char_name: { type: 'string' },
    title: { type: 'string' },
    card_type: { type: 'string' },
    rarity: { type: 'string' },
    is_welfare: { type: 'boolean' },
    release_date: { type: ['string', 'null'] },
    is_predicted_date: { type: 'boolean' },
    unique_effect: { type: ['string', 'null'] },
    effects: {
      type: 'array',
      items: {
        type: 'object',
        required: ['effect_name', 'lb0', 'lb1', 'lb2', 'lb3', 'mlb'],
        additionalProperties: false,
        properties: {
          effect_name: { type: 'string' },
          lb0: { type: ['number', 'null'] },
          lb1: { type: ['number', 'null'] },
          lb2: { type: ['number', 'null'] },
          lb3: { type: ['number', 'null'] },
          mlb: { type: ['number', 'null'] },
        },
      },
    },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        required: ['skill_id', 'acquisition'],
        additionalProperties: false,
        properties: {
          skill_id: { type: 'integer' },
          acquisition: { type: 'string' },
        },
      },
    },
  },
};
