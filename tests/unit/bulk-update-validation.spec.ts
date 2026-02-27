import { bulkUpdateLeadsSchema } from '../../src/lib/validation';

describe('bulkUpdateLeadsSchema', () => {
  it('accepts valid bulk payload', () => {
    const payload = {
      leadIds: ['lead-1', 'lead-2'],
      pipelineStatus: 'Interested',
    };

    const parsed = bulkUpdateLeadsSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('rejects empty lead IDs', () => {
    const payload = {
      leadIds: [],
      pipelineStatus: 'Contacted',
    };

    const parsed = bulkUpdateLeadsSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });
});
