import { describe, it, expect, vi } from 'vitest';
import { Collection, ChatInputCommandInteraction } from 'discord.js';
import { execute, buildEmbed, capitalize } from '../../commands/uma';
import { UmaIndex, UmaDetail } from '../../types';
import { Fetcher } from '../../api/client';

const mockUmaDetail: UmaDetail = {
  id: 100101,
  name: 'Special Week',
  subtitle: 'a promising newcomer',
  apt_turf: 'A',
  apt_dirt: 'G',
  apt_short: 'G',
  apt_mile: 'A',
  apt_medium: 'A',
  apt_long: 'B',
  apt_front: 'A',
  apt_pace: 'B',
  apt_late: 'C',
  apt_end: 'G',
  growth_speed: 10,
  growth_stamina: 20,
  growth_power: 15,
  growth_guts: 5,
  growth_wit: 10,
  skills: [
    {
      id: 1,
      name: 'Unique Skill',
      category: 'speed',
      rarity: 'unique',
      sp_cost: 100,
      acquisition: 'Unique',
      evolved_from: null,
    },
    {
      id: 2,
      name: 'Unique Skill 2',
      category: 'speed',
      rarity: 'unique',
      sp_cost: 80,
      acquisition: 'Unique',
      evolved_from: null,
    },
    {
      id: 3,
      name: 'Innate Skill',
      category: 'speed',
      rarity: 'normal',
      sp_cost: 50,
      acquisition: 'Innate',
      evolved_from: null,
    },
    {
      id: 4,
      name: 'Event Skill',
      category: 'speed',
      rarity: 'normal',
      sp_cost: 50,
      acquisition: 'Event',
      evolved_from: null,
    },
  ],
};

function makeCache(entries: UmaIndex[]): Collection<number, UmaIndex> {
  const cache = new Collection<number, UmaIndex>();
  entries.forEach((e) => cache.set(e.id, e));
  return cache;
}

function makeFetcher(detail: UmaDetail): Fetcher {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(detail),
  } as Response);
}

function makeInteraction(name: string): ChatInputCommandInteraction {
  const reply = vi.fn().mockResolvedValue(undefined);
  const deferReply = vi.fn().mockResolvedValue(undefined);
  const editReply = vi.fn().mockResolvedValue(undefined);

  return {
    options: { getString: vi.fn().mockReturnValue(name) },
    reply,
    deferReply,
    editReply,
    deferred: false,
    user: { id: 'user-123' },
    channel: null,
  } as unknown as ChatInputCommandInteraction;
}

describe('capitalize', () => {
  it('capitalizes the first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('handles already capitalized strings', () => {
    expect(capitalize('Wordle')).toBe('Wordle');
  });

  it('handles empty string', () => {
    expect(capitalize('')).toBe('');
  });
});

describe('buildEmbed', () => {
  it('sets title and URL correctly', () => {
    const embed = buildEmbed(mockUmaDetail);
    const data = embed.toJSON();
    expect(data.title).toBe('Special Week');
    expect(data.url).toBe('https://gametora.com/umamusume/characters/100101-special-week');
  });

  it('capitalizes the subtitle in description', () => {
    const embed = buildEmbed(mockUmaDetail);
    expect(embed.toJSON().description).toBe('A promising newcomer');
  });

  it('includes growth field', () => {
    const embed = buildEmbed(mockUmaDetail);
    const fields = embed.toJSON().fields ?? [];
    const growth = fields.find((f) => f.name === 'Growth');
    expect(growth?.value).toBe('Speed: 10% | Stamina: 20% | Power: 15% | Guts: 5% | Wit: 10%');
  });

  it('groups skills by acquisition in correct order', () => {
    const embed = buildEmbed(mockUmaDetail);
    const fields = embed.toJSON().fields ?? [];
    const skillFieldNames = fields
      .filter((f) => ['Unique', 'Innate', 'Awakening', 'Event', 'Evolution'].includes(f.name))
      .map((f) => f.name);
    expect(skillFieldNames).toEqual(['Unique', 'Innate', 'Event']);
  });

  it('groups multiple skills under the same acquisition', () => {
    const embed = buildEmbed(mockUmaDetail);
    const fields = embed.toJSON().fields ?? [];
    const unique = fields.find((f) => f.name === 'Unique');
    expect(unique?.value).toContain('Unique Skill');
    expect(unique?.value).toContain('Unique Skill 2');
  });

  it('omits acquisition groups with no skills', () => {
    const embed = buildEmbed(mockUmaDetail);
    const fields = embed.toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Awakening')).toBeUndefined();
    expect(fields.find((f) => f.name === 'Evolution')).toBeUndefined();
  });
});

describe('execute', () => {
  const cache = makeCache([
    { id: 100101, name: 'Special Week', version: 'default' },
    { id: 100102, name: 'Special Week', version: 'summer' },
    { id: 100201, name: 'Silence Suzuka', version: 'default' },
  ]);

  it('replies ephemerally when no match found', async () => {
    const interaction = makeInteraction('nonexistent');
    await execute(interaction, cache, makeFetcher(mockUmaDetail));
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No umamusume found') }),
    );
  });

  it('defers and edits reply on single match', async () => {
    const interaction = makeInteraction('suzuka');
    await execute(interaction, cache, makeFetcher(mockUmaDetail));
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });

  it('shows select menu on multiple matches', async () => {
    const interaction = makeInteraction('special');
    await execute(interaction, cache, makeFetcher(mockUmaDetail));
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Multiple umamusume found'),
        components: expect.any(Array),
      }),
    );
  });

  describe('collector', () => {
    function makeCollectorInteraction() {
      const handlers: Record<string, (arg: unknown) => Promise<void>> = {};
      const mockCollector = {
        on: vi.fn((event: string, handler: (arg: unknown) => Promise<void>) => {
          handlers[event] = handler;
        }),
      };
      const interaction = makeInteraction('special');
      (interaction as unknown as Record<string, unknown>).channel = {
        createMessageComponentCollector: vi.fn().mockReturnValue(mockCollector),
      };
      return { interaction, handlers, mockCollector };
    }

    it('fetches and edits reply when user selects an option', async () => {
      const { interaction, handlers } = makeCollectorInteraction();
      const fetcher = makeFetcher(mockUmaDetail);
      await execute(interaction, cache, fetcher);

      const selectInteraction = {
        customId: 'uma_select',
        user: { id: 'user-123' },
        values: ['100101'],
        deferUpdate: vi.fn().mockResolvedValue(undefined),
      };

      await handlers['collect'](selectInteraction);

      expect(selectInteraction.deferUpdate).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array), components: [] }),
      );
    });

    it('ignores interactions from other users', async () => {
      const { interaction } = makeCollectorInteraction();
      await execute(interaction, cache, makeFetcher(mockUmaDetail));

      const channelMock = interaction.channel as unknown as Record<
        string,
        ReturnType<typeof vi.fn>
      >;
      const { filter } = channelMock.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };
      expect(filter({ customId: 'uma_select', user: { id: 'other-user' } })).toBe(false);
    });

    it('ignores interactions with wrong customId', async () => {
      const { interaction } = makeCollectorInteraction();
      await execute(interaction, cache, makeFetcher(mockUmaDetail));

      const channelMock = interaction.channel as unknown as Record<
        string,
        ReturnType<typeof vi.fn>
      >;
      const { filter } = channelMock.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };
      expect(filter({ customId: 'wrong_id', user: { id: 'user-123' } })).toBe(false);
    });

    it('edits reply with timeout message when collector ends with no selection', async () => {
      const { interaction, handlers } = makeCollectorInteraction();
      await execute(interaction, cache, makeFetcher(mockUmaDetail));

      await handlers['end'](new Collection());

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Timed out.', components: [] }),
      );
    });

    it('does not edit reply with timeout when collector ends with a selection', async () => {
      const { interaction, handlers } = makeCollectorInteraction();
      await execute(interaction, cache, makeFetcher(mockUmaDetail));

      const collected = new Collection();
      collected.set('1', {});
      await handlers['end'](collected);

      expect(interaction.editReply).not.toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Timed out.' }),
      );
    });
  });
});
