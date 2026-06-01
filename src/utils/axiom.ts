import { createHash } from 'crypto';

interface CommandEvent {
  user_id: string;
  guild_id: string | null;
  command: string;
  latency_ms: number;
  success: boolean;
}

function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex');
}

async function ingest(event: Record<string, unknown>): Promise<void> {
  const token = process.env.AXIOM_TOKEN;
  const dataset = process.env.AXIOM_DATASET;

  try {
    const res = await fetch(`https://api.axiom.co/v1/datasets/${dataset}/ingest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ _time: new Date().toISOString(), ...event }]),
    });

    if (!res.ok) {
      console.warn(`Axiom ingest failed: ${res.status}`);
    }
  } catch (e) {
    console.warn('Axiom ingest error:', e);
  }
}

export async function logCommand(event: CommandEvent): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return;

  await ingest({
    user_id: hashUserId(event.user_id),
    guild_id: event.guild_id,
    command: event.command,
    latency_ms: event.latency_ms,
    success: event.success,
  });
}
