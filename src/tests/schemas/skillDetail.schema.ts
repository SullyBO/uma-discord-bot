export const skillTriggerItemSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    duration: { type: ['number', 'null'] },
    scaling: { type: ['string', 'null'] },
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
  required: ['id', 'duration', 'scaling', 'effects', 'conditions', 'preconditions'],
  additionalProperties: false,
} as const;

export const skillDetailSchema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
    ingame_description: { type: 'string' },
    category: { type: 'string' },
    rarity: { type: 'string' },
    sp_cost: { type: 'number' },
    is_jp_only: { type: 'boolean' },
    inherited_skill: {
      oneOf: [
        {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
            ingame_description: { type: 'string' },
            category: { type: 'string' },
            rarity: { type: 'string' },
            sp_cost: { type: 'number' },
            triggers: {
              type: 'array',
              items: skillTriggerItemSchema,
            },
          },
          required: [
            'id',
            'name',
            'ingame_description',
            'category',
            'rarity',
            'sp_cost',
            'triggers',
          ],
          additionalProperties: false,
        },
        { type: 'null' },
      ],
    },
    triggers: {
      type: 'array',
      items: skillTriggerItemSchema,
    },
    acquisitions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          source_id: { type: 'number' },
          source_type: { type: 'string' },
          acquisition: { type: 'string' },
        },
        required: ['source_id', 'source_type', 'acquisition'],
        additionalProperties: false,
      },
    },
  },
  required: [
    'id',
    'name',
    'ingame_description',
    'category',
    'rarity',
    'sp_cost',
    'is_jp_only',
    'inherited_skill',
    'triggers',
    'acquisitions',
  ],
  additionalProperties: false,
} as const;
