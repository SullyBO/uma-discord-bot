import { Schema } from 'ajv';

export const skillIndexSchema: Schema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
    },
    required: ['id', 'name'],
    additionalProperties: false,
  },
};
