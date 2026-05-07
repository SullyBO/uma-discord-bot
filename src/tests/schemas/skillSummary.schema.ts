export const skillSummarySchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'number' },
      name: { type: 'string' },
      category: { type: 'string' },
      rarity: { type: 'string' },
      sp_cost: { type: 'number' },
      is_jp_only: { type: 'boolean' },
    },
    required: ['id', 'name', 'category', 'rarity', 'sp_cost', 'is_jp_only'],
    additionalProperties: false,
  },
};
