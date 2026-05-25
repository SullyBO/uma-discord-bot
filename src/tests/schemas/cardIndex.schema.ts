import { Schema } from 'ajv';

export const cardIndexSchema: Schema = {
  type: 'array',
  items: {
    type: 'object',
    required: ['support_id', 'char_name', 'title', 'card_type', 'rarity'],
    additionalProperties: false,
    properties: {
      support_id: { type: 'integer' },
      char_name: { type: 'string' },
      title: { type: 'string' },
      card_type: { type: 'string' },
      rarity: { type: 'string' },
    },
  },
};
