import { AirtableClient, LeadsRepository } from '../../src/lib/airtable';
import { assertNoDuplicateLeadByEmail, DuplicateLeadError } from '../../src/lib/leads';

describe('airtable repositories', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('lists leads with status and score filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        records: [
          {
            id: 'rec_1',
            createdTime: '2026-02-26T00:00:00.000Z',
            fields: {
              id: 'lead_1',
              full_name: 'Jane Doe',
              email: 'jane@example.com',
              form_score: 90,
              interaction_score: 40,
              total_score: 70,
              tier: 'Warm',
              pipeline_status: 'Contacted',
              created_at: '2026-02-26T00:00:00.000Z',
              updated_at: '2026-02-26T00:00:00.000Z',
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const repository = new LeadsRepository(new AirtableClient({ apiKey: 'key', baseId: 'base' }));
    const leads = await repository.list({ status: 'Contacted', minScore: 60 });

    expect(leads).toHaveLength(1);
    expect(leads[0].email).toBe('jane@example.com');
    const requestUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestUrl).toContain('filterByFormula=AND%28%7Bpipeline_status%7D%3D%22Contacted%22%2C%7Btotal_score%7D%3E%3D60%29');
  });

  it('throws duplicate error when lead email already exists', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        records: [
          {
            id: 'rec_1',
            createdTime: '2026-02-26T00:00:00.000Z',
            fields: {
              id: 'lead_1',
              full_name: 'Jane Doe',
              email: 'jane@example.com',
              form_score: 90,
              interaction_score: 40,
              total_score: 70,
              tier: 'Warm',
              pipeline_status: 'Contacted',
              created_at: '2026-02-26T00:00:00.000Z',
              updated_at: '2026-02-26T00:00:00.000Z',
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const repository = new LeadsRepository(new AirtableClient({ apiKey: 'key', baseId: 'base' }));
    await expect(assertNoDuplicateLeadByEmail(repository, 'jane@example.com')).rejects.toBeInstanceOf(
      DuplicateLeadError,
    );
  });
});

