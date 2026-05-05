export const umaIndexSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'number' },
      name: { type: 'string' },
      version: { type: 'string' },
    },
    required: ['id', 'name', 'version'],
    additionalProperties: false,
  },
};
