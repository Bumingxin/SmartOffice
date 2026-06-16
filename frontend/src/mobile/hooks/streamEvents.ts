export interface StreamParseResult {
  events: any[];
  buffer: string;
}

export function parseStreamEvents(input: string): StreamParseResult {
  const lines = input.split('\n');
  const buffer = lines.pop() || '';
  const events: any[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(':')) continue;
    if (!line.startsWith('data:')) continue;

    const payload = line.slice(5).trimStart();
    if (!payload) continue;

    try {
      events.push(JSON.parse(payload));
    } catch {
      // A malformed event should not break a long-running mobile stream.
    }
  }

  return { events, buffer };
}

export async function readJsonEventStream(
  response: Response,
  onEvent: (event: any) => void,
): Promise<void> {
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseStreamEvents(buffer);
    buffer = parsed.buffer;
    parsed.events.forEach(onEvent);
  }

  const trailing = decoder.decode();
  if (trailing) {
    const parsed = parseStreamEvents(buffer + trailing + '\n');
    parsed.events.forEach(onEvent);
  }
}
