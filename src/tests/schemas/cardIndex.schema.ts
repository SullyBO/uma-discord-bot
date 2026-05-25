import { Schema } from 'ajv';

export const cardIndexSchema: Schema = {
  type: 'array',
  items: {
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
    },
  },
};
