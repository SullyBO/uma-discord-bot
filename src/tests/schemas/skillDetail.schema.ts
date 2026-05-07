export const skillDetailSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    category: { type: 'string' },
    rarity: { type: 'string' },
    sp_cost: { type: 'number' },
    is_jp_only: { type: 'boolean' },
    triggers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          effects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                effect_type: { type: 'string' },
                effect_value: { type: ['number', 'null'] },
              },
              required: ['effect_type', 'effect_value'],
              additionalProperties: false,
            },
          },
          conditions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                cond_key: { type: 'string' },
                operator: { type: 'string' },
                cond_val: { type: 'string' },
                is_or: { type: 'boolean' },
              },
              required: ['cond_key', 'operator', 'cond_val', 'is_or'],
              additionalProperties: false,
            },
          },
          preconditions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                cond_key: { type: 'string' },
                operator: { type: 'string' },
                cond_val: { type: 'string' },
                is_or: { type: 'boolean' },
              },
              required: ['cond_key', 'operator', 'cond_val', 'is_or'],
              additionalProperties: false,
            },
          },
        },
        required: ['id', 'effects', 'conditions', 'preconditions'],
        additionalProperties: false,
      },
    },
  },
  required: ['id', 'name', 'category', 'rarity', 'sp_cost', 'is_jp_only', 'triggers'],
  additionalProperties: false,
};
