export interface AirtableClientConfig {
  apiKey: string;
  baseId: string;
  timeoutMs?: number;
}

interface AirtableListResponse<TFields> {
  records: Array<{
    id: string;
    fields: TFields;
    createdTime: string;
  }>;
}

interface AirtableRecordResponse<TFields> {
  id: string;
  fields: TFields;
  createdTime: string;
}

export class AirtableClient {
  private readonly apiKey: string;
  private readonly baseId: string;
  private readonly timeoutMs: number;

  constructor(config: AirtableClientConfig) {
    this.apiKey = config.apiKey;
    this.baseId = config.baseId;
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  private getBaseUrl(): string {
    return `https://api.airtable.com/v0/${this.baseId}`;
  }

  private getAuthHeader(): string {
    return `Bearer ${this.apiKey}`;
  }

  private getHeaders(): HeadersInit {
    return {
      Authorization: this.getAuthHeader(),
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.getBaseUrl()}/${path}`, {
        ...init,
        headers: {
          ...this.getHeaders(),
          ...(init?.headers ?? {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.text();
        throw new Error(`Airtable request failed (${response.status}): ${payload}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async listRecords<TFields>(
    table: string,
    query?: {
      filterByFormula?: string;
      sortField?: string;
      sortDirection?: 'asc' | 'desc';
      maxRecords?: number;
      pageSize?: number;
    },
  ): Promise<Array<{ id: string; fields: TFields; createdTime: string }>> {
    const params = new URLSearchParams();
    if (query?.filterByFormula) params.set('filterByFormula', query.filterByFormula);
    if (query?.sortField) {
      params.set('sort[0][field]', query.sortField);
      params.set('sort[0][direction]', query.sortDirection ?? 'asc');
    }
    if (query?.maxRecords) params.set('maxRecords', String(query.maxRecords));
    if (query?.pageSize) params.set('pageSize', String(query.pageSize));

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const data = await this.request<AirtableListResponse<TFields>>(
      `${encodeURIComponent(table)}${suffix}`,
      { method: 'GET' },
    );
    return data.records;
  }

  async createRecord<TFields>(
    table: string,
    fields: TFields,
  ): Promise<{ id: string; fields: TFields; createdTime: string }> {
    return this.request<AirtableRecordResponse<TFields>>(encodeURIComponent(table), {
      method: 'POST',
      body: JSON.stringify({ fields }),
    });
  }

  async updateRecord<TFields>(
    table: string,
    id: string,
    fields: Partial<TFields>,
  ): Promise<{ id: string; fields: TFields; createdTime: string }> {
    return this.request<AirtableRecordResponse<TFields>>(
      `${encodeURIComponent(table)}/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ fields }),
      },
    );
  }

  async deleteRecord(table: string, id: string): Promise<void> {
    await this.request(`${encodeURIComponent(table)}/${id}`, { method: 'DELETE' });
  }
}
