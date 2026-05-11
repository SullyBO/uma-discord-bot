import { describe, it, expect, vi } from 'vitest';
import { Collection, ChatInputCommandInteraction } from 'discord.js';
import { execute, buildDetailsEmbed, buildSkillsEmbed, buildPageRow } from '../../commands/uma';
import { UmaIndex, UmaDetail } from '../../types';
import { Fetcher } from '../../api/client';
import type { APIButtonComponentWithCustomId } from 'discord.js';

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
  release_date: '2025-06-26',
  is_predicted_date: false,
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
  return {
    options: { getString: vi.fn().mockReturnValue(name) },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    deferred: false,
    user: { id: 'user-123' },
    channel: null,
  } as unknown as ChatInputCommandInteraction;
}

function makeSelectInteraction() {
  return {
    customId: 'uma_select',
    user: { id: 'user-123' },
    values: ['100101'],
    deferUpdate: vi.fn().mockResolvedValue(undefined),
  };
}

function getFilter(interaction: ChatInputCommandInteraction, callIndex: number) {
  const channelMock = interaction.channel as unknown as Record<string, ReturnType<typeof vi.fn>>;
  const { filter } = channelMock.createMessageComponentCollector.mock.calls[callIndex][0] as {
    filter: (i: unknown) => boolean;
  };
  return filter;
}

async function getToggleHandlers(
  interaction: ChatInputCommandInteraction,
  handlers: Record<string, (arg: unknown) => Promise<void>>,
) {
  await handlers['collect'](makeSelectInteraction());
  const channelMock = interaction.channel as unknown as Record<string, ReturnType<typeof vi.fn>>;
  const mockToggleCollector = channelMock.createMessageComponentCollector.mock.results[1].value;
  const toggleHandlers: Record<string, (arg: unknown) => Promise<void>> = {};
  mockToggleCollector.on.mock.calls.forEach(
    ([event, handler]: [string, (arg: unknown) => Promise<void>]) => {
      toggleHandlers[event] = handler;
    },
  );
  return toggleHandlers;
}

function makeCollectorInteraction(name: string) {
  const handlers: Record<string, (arg: unknown) => Promise<void>> = {};
  const mockCollector = {
    on: vi.fn((event: string, handler: (arg: unknown) => Promise<void>) => {
      handlers[event] = handler;
    }),
  };
  const interaction = makeInteraction(name);
  (interaction as unknown as Record<string, unknown>).channel = {
    createMessageComponentCollector: vi.fn().mockReturnValue(mockCollector),
  };
  return { interaction, handlers, mockCollector };
}

const cache = makeCache([
  { id: 100101, name: 'Special Week', version: 'default' },
  { id: 100102, name: 'Special Week', version: 'summer' },
  { id: 100201, name: 'Silence Suzuka', version: 'default' },
]);

describe('buildDetailsEmbed', () => {
  it('sets title and URL correctly', () => {
    const embed = buildDetailsEmbed(mockUmaDetail);
    const data = embed.toJSON();
    expect(data.title).toBe('Special Week');
    expect(data.url).toBe('https://gametora.com/umamusume/characters/100101-special-week');
  });

  it('capitalizes the subtitle in description', () => {
    const embed = buildDetailsEmbed(mockUmaDetail);
    expect(embed.toJSON().description).toBe('A promising newcomer');
  });

  it('includes growth field', () => {
    const fields = buildDetailsEmbed(mockUmaDetail).toJSON().fields ?? [];
    const growth = fields.find((f) => f.name === 'Growth');
    expect(growth?.value).toBe('Speed: 10% | Stamina: 20% | Power: 15% | Guts: 5% | Wit: 10%');
  });

  it('does not include skill fields', () => {
    const fields = buildDetailsEmbed(mockUmaDetail).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Unique')).toBeUndefined();
    expect(fields.find((f) => f.name === 'Innate')).toBeUndefined();
  });
});

describe('buildSkillsEmbed', () => {
  it('sets title and URL correctly', () => {
    const data = buildSkillsEmbed(mockUmaDetail).toJSON();
    expect(data.title).toBe('Special Week');
    expect(data.url).toBe('https://gametora.com/umamusume/characters/100101-special-week');
  });

  it('groups skills by acquisition in correct order', () => {
    const fields = buildSkillsEmbed(mockUmaDetail).toJSON().fields ?? [];
    const names = fields
      .filter((f) => ['Unique', 'Innate', 'Awakening', 'Event', 'Evolution'].includes(f.name))
      .map((f) => f.name);
    expect(names).toEqual(['Unique', 'Innate', 'Event']);
  });

  it('groups multiple skills under the same acquisition', () => {
    const fields = buildSkillsEmbed(mockUmaDetail).toJSON().fields ?? [];
    const unique = fields.find((f) => f.name === 'Unique');
    expect(unique?.value).toContain('Unique Skill');
    expect(unique?.value).toContain('Unique Skill 2');
  });

  it('omits acquisition groups with no skills', () => {
    const fields = buildSkillsEmbed(mockUmaDetail).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Awakening')).toBeUndefined();
    expect(fields.find((f) => f.name === 'Evolution')).toBeUndefined();
  });
});

describe('buildPageRow', () => {
  it('shows View Skills label when on details page', () => {
    const components = buildPageRow('details').toJSON().components;
    expect((components[0] as APIButtonComponentWithCustomId).label).toBe('View Skills');
  });

  it('shows View Details label when on skills page', () => {
    const components = buildPageRow('skills').toJSON().components;
    expect((components[0] as APIButtonComponentWithCustomId).label).toBe('View Details');
  });
});

describe('execute', () => {
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
      expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) }),
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

  describe('single match collector', () => {
    it('ignores toggle interactions from other users', async () => {
      const { interaction } = makeCollectorInteraction('suzuka');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      expect(
        getFilter(interaction, 0)({ customId: 'uma_toggle', user: { id: 'other-user' } }),
      ).toBe(false);
    });

    it('ignores toggle interactions with wrong customId', async () => {
      const { interaction } = makeCollectorInteraction('suzuka');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      expect(getFilter(interaction, 0)({ customId: 'wrong_id', user: { id: 'user-123' } })).toBe(
        false,
      );
    });

    it('toggles to skills page on button click', async () => {
      const { interaction, handlers } = makeCollectorInteraction('suzuka');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));

      const buttonInteraction = {
        customId: 'uma_toggle',
        user: { id: 'user-123' },
        update: vi.fn().mockResolvedValue(undefined),
      };
      await handlers['collect'](buttonInteraction);

      expect(buttonInteraction.update).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) }),
      );
    });

    it('removes components when collector ends', async () => {
      const { interaction, handlers } = makeCollectorInteraction('suzuka');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      await handlers['end'](undefined);
      expect(interaction.editReply).toHaveBeenCalledWith({ components: [] });
    });
  });

  describe('select collector', () => {
    it('ignores interactions from other users', async () => {
      const { interaction } = makeCollectorInteraction('special');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      expect(
        getFilter(interaction, 0)({ customId: 'uma_select', user: { id: 'other-user' } }),
      ).toBe(false);
    });

    it('ignores interactions with wrong customId', async () => {
      const { interaction } = makeCollectorInteraction('special');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      expect(getFilter(interaction, 0)({ customId: 'wrong_id', user: { id: 'user-123' } })).toBe(
        false,
      );
    });

    it('fetches and edits reply when user selects an option', async () => {
      const { interaction, handlers } = makeCollectorInteraction('special');
      const fetcher = makeFetcher(mockUmaDetail);
      await execute(interaction, cache, fetcher);

      const selectInteraction = makeSelectInteraction();
      await handlers['collect'](selectInteraction);

      expect(selectInteraction.deferUpdate).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) }),
      );
    });

    it('edits reply with timeout message when collector ends with no selection', async () => {
      const { interaction, handlers } = makeCollectorInteraction('special');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      await handlers['end'](new Collection());
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Timed out.', components: [] }),
      );
    });

    it('does not edit reply with timeout when collector ends with a selection', async () => {
      const { interaction, handlers } = makeCollectorInteraction('special');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      const collected = new Collection();
      collected.set('1', {});
      await handlers['end'](collected);
      expect(interaction.editReply).not.toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Timed out.' }),
      );
    });

    it('ignores toggle interactions from other users after selection', async () => {
      const { interaction, handlers } = makeCollectorInteraction('special');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      await getToggleHandlers(interaction, handlers);
      expect(
        getFilter(interaction, 1)({ customId: 'uma_toggle', user: { id: 'other-user' } }),
      ).toBe(false);
    });

    it('ignores toggle interactions with wrong customId after selection', async () => {
      const { interaction, handlers } = makeCollectorInteraction('special');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      await getToggleHandlers(interaction, handlers);
      expect(getFilter(interaction, 1)({ customId: 'wrong_id', user: { id: 'user-123' } })).toBe(
        false,
      );
    });

    it('toggles to skills page after selecting from menu', async () => {
      const { interaction, handlers } = makeCollectorInteraction('special');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      const toggleHandlers = await getToggleHandlers(interaction, handlers);

      const buttonInteraction = {
        customId: 'uma_toggle',
        user: { id: 'user-123' },
        update: vi.fn().mockResolvedValue(undefined),
      };
      await toggleHandlers['collect'](buttonInteraction);

      expect(buttonInteraction.update).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) }),
      );
    });

    it('removes components when toggle collector ends after selection', async () => {
      const { interaction, handlers } = makeCollectorInteraction('special');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      const toggleHandlers = await getToggleHandlers(interaction, handlers);
      await toggleHandlers['end'](undefined);
      expect(interaction.editReply).toHaveBeenCalledWith({ components: [] });
    });
  });
});
