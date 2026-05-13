import { describe, it, expect, vi } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';
import { buildEmbed, execute } from '../../commands/help';

function makeInteraction(topic: string): ChatInputCommandInteraction {
  return {
    options: { getString: vi.fn().mockReturnValue(topic) },
    reply: vi.fn().mockResolvedValue(undefined),
  } as unknown as ChatInputCommandInteraction;
}

describe('buildEmbed', () => {
  describe('categories', () => {
    it('sets title to Skill Categories', () => {
      const embed = buildEmbed('categories');
      expect(embed.toJSON().title).toBe('Skill Categories (based on skill icons)');
    });

    it('has two inline fields', () => {
      const fields = buildEmbed('categories').toJSON().fields ?? [];
      expect(fields).toHaveLength(2);
      expect(fields[0].inline).toBe(true);
      expect(fields[1].inline).toBe(true);
    });

    it('left field contains first category', () => {
      const fields = buildEmbed('categories').toJSON().fields ?? [];
      expect(fields[0].value).toContain('green');
    });

    it('right field contains last category', () => {
      const fields = buildEmbed('categories').toJSON().fields ?? [];
      expect(fields[1].value).toContain('unique_recovery');
    });
  });

  describe('effect types', () => {
    it('sets title to Effect Types', () => {
      const embed = buildEmbed('effect types');
      expect(embed.toJSON().title).toBe('Effect Types');
    });

    it('has two inline fields', () => {
      const fields = buildEmbed('effect types').toJSON().fields ?? [];
      expect(fields).toHaveLength(2);
      expect(fields[0].inline).toBe(true);
      expect(fields[1].inline).toBe(true);
    });

    it('left field contains first effect type', () => {
      const fields = buildEmbed('effect types').toJSON().fields ?? [];
      expect(fields[0].value).toContain('Speed Stat Up');
    });

    it('right field contains last effect type', () => {
      const fields = buildEmbed('effect types').toJSON().fields ?? [];
      expect(fields[1].value).toContain('Activate Related Skills On All Uma');
    });
  });
});

describe('execute', () => {
  it('replies ephemerally with categories embed', async () => {
    const interaction = makeInteraction('categories');
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        flags: expect.anything(),
      }),
    );
  });

  it('replies ephemerally with effect types embed', async () => {
    const interaction = makeInteraction('effect types');
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        flags: expect.anything(),
      }),
    );
  });

  it('calls getString with topic and required=true', async () => {
    const interaction = makeInteraction('categories');
    await execute(interaction);
    expect(interaction.options.getString).toHaveBeenCalledWith('topic', true);
  });
});
