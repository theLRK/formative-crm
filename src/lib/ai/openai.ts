const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function generateDraftReply(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You write concise professional email drafts for a single-agent real estate CRM. Output plain text only.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`OpenAI draft request failed (${response.status}): ${payload}`);
  }

  const data = (await response.json()) as OpenAIChatCompletionResponse;
  const draft = data.choices?.[0]?.message?.content?.trim();
  if (!draft) {
    throw new Error('OpenAI response did not include draft content');
  }

  return draft;
}
