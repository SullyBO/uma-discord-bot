import { describe, it, expect, vi } from 'vitest';
import { Collection, ChatInputCommandInteraction } from 'discord.js';
import { execute, buildEmbed, buildPages, buildRow, formatCardLine } from '../../commands/cards';
import { CardIndex } from '../../types';

function makeCard(overrides: Partial<CardIndex> = {}): CardIndex {
  return {
    support_id: 10001,
    char_name: 'Special Week',
    title: 'My Very Best',
    card_type: 'speed',
    rarity: 'ssr',
    is_welfare: false,
    release_date: '2020-01-01',
    is_predicted_date: false,
    ...overrides,
  };
}

function makeCache(entries: CardIndex[]): Collection<number, CardIndex> {
  const cache = new Collection<number, CardIndex>();
  entries.forEach((e) => cache.set(e.support_id, e));
  return cache;
}

function makeInteraction(
  options: {
    type?: string | null;
    rarity?: string | null;
    welfare?: boolean | null;
    released?: boolean | null;
  } = {},
): ChatInputCommandInteraction {
  const handlers: Record<string, (arg: unknown) => Promise<void>> = {};
  const mockCollector = {
    on: vi.fn((event: string, handler: (arg: unknown) => Promise<void>) => {
      handlers[event] = handler;
    }),
    stop: vi.fn(),
  };

  const interaction = {
    options: {
      getString: vi.fn((key: string) => options[key as 'type' | 'rarity'] ?? null),
      getBoolean: vi.fn((key: string) => options[key as 'welfare' | 'released'] ?? null),
    },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    deferred: false,
    user: { id: 'user-123' },
    channel: {
      createMessageComponentCollector: vi.fn().mockReturnValue(mockCollector),
    },
  } as unknown as ChatInputCommandInteraction;

  return Object.assign(interaction, { _handlers: handlers, _collector: mockCollector });
}

const baseCache = makeCache([
  makeCard({ support_id: 10001, char_name: 'Special Week', rarity: 'ssr', card_type: 'speed' }),
  makeCard({ support_id: 10002, char_name: 'Silence Suzuka', rarity: 'sr', card_type: 'stamina' }),
  makeCard({ support_id: 10003, char_name: 'Tokai Teio', rarity: 'r', card_type: 'speed' }),
  makeCard({
    support_id: 10004,
    char_name: 'Mejiro McQueen',
    rarity: 'ssr',
    card_type: 'speed',
    is_welfare: true,
  }),
  makeCard({
    support_id: 10005,
    char_name: 'Gold Ship',
    rarity: 'ssr',
    card_type: 'guts',
    release_date: '2020-01-01',
  }),
]);

describe('formatCardLine', () => {
  it('formats card name and title in bold', () => {
    const result = formatCardLine(makeCard());
    expect(result).toContain('**Special Week**');
    expect(result).toContain('My Very Best');
  });

  it('includes card type and rarity', () => {
    const result = formatCardLine(makeCard());
    expect(result).toContain('Speed');
    expect(result).toContain('SSR');
  });

  it('includes welfare tag for welfare cards', () => {
    const result = formatCardLine(makeCard({ is_welfare: true }));
    expect(result).toContain('Welfare');
  });

  it('omits welfare tag for non-welfare cards', () => {
    const result = formatCardLine(makeCard({ is_welfare: false }));
    expect(result).not.toContain('Welfare');
  });

  it('shows predicted release date with month and year', () => {
    const result = formatCardLine(
      makeCard({ release_date: '2025-06-01', is_predicted_date: true }),
    );
    expect(result).toContain('Expected');
    expect(result).toContain('June 2025');
  });

  it('shows release date for future cards', () => {
    const result = formatCardLine(
      makeCard({ release_date: '2099-01-01', is_predicted_date: false }),
    );
    expect(result).toContain('Release date');
  });

  it('shows released date for past cards', () => {
    const result = formatCardLine(
      makeCard({ release_date: '2020-01-01', is_predicted_date: false }),
    );
    expect(result).toContain('Released');
  });

  it('omits release info when release_date is null', () => {
    const result = formatCardLine(makeCard({ release_date: null }));
    expect(result).not.toContain('Release');
    expect(result).not.toContain('Expected');
  });
});

describe('buildPages', () => {
  it('puts up to 5 items per page', () => {
    const lines = Array.from({ length: 5 }, (_, i) => `card ${i}`);
    expect(buildPages(lines)).toHaveLength(1);
  });

  it('splits into multiple pages when over 5 items', () => {
    const lines = Array.from({ length: 6 }, (_, i) => `card ${i}`);
    expect(buildPages(lines)).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(buildPages([])).toHaveLength(0);
  });
});

describe('buildEmbed', () => {
  it('sets title to Support Cards when no filters', () => {
    const embed = buildEmbed('content', 0, 1, {});
    expect(embed.toJSON().title).toBe('Support Cards - SSR/SR only');
  });

  it('includes type in title when filtered', () => {
    const embed = buildEmbed('content', 0, 1, { type: 'speed' });
    expect(embed.toJSON().title).toContain('Speed');
  });

  it('includes rarity in title when filtered', () => {
    const embed = buildEmbed('content', 0, 1, { rarity: 'ssr' });
    expect(embed.toJSON().title).toContain('SSR');
  });

  it('includes welfare label when filtered', () => {
    const embed = buildEmbed('content', 0, 1, { welfare: true });
    expect(embed.toJSON().title).toContain('Welfare only');
  });

  it('includes unreleased label when released is false', () => {
    const embed = buildEmbed('content', 0, 1, { released: false });
    expect(embed.toJSON().title).toContain('Including unreleased');
  });

  it('sets description to page content', () => {
    const embed = buildEmbed('some content', 0, 1, {});
    expect(embed.toJSON().description).toBe('some content');
  });

  it('sets footer with page number', () => {
    const embed = buildEmbed('content', 1, 3, {});
    expect(embed.toJSON().footer?.text).toContain('Page 2 of 3');
  });
});

describe('buildRow', () => {
  it('disables prev button on first page', () => {
    const components = buildRow(0, 3).toJSON().components;
    expect(components[0].disabled).toBe(true);
    expect(components[1].disabled).toBe(false);
  });

  it('disables next button on last page', () => {
    const components = buildRow(2, 3).toJSON().components;
    expect(components[0].disabled).toBe(false);
    expect(components[1].disabled).toBe(true);
  });

  it('enables both buttons on a middle page', () => {
    const components = buildRow(1, 3).toJSON().components;
    expect(components[0].disabled).toBe(false);
    expect(components[1].disabled).toBe(false);
  });
});

describe('execute', () => {
  it('replies with no results when nothing matches filters', async () => {
    const interaction = makeInteraction({ type: 'nonexistent' });
    await execute(interaction, baseCache);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'No cards found matching those filters.' }),
    );
  });

  it('filters out R rarity cards by default', async () => {
    const interaction = makeInteraction();
    await execute(interaction, baseCache);
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('filters out unreleased cards by default', async () => {
    const onlyFuture = makeCache([makeCard({ support_id: 99999, release_date: '2099-01-01' })]);
    const interaction = makeInteraction();
    await execute(interaction, onlyFuture);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'No cards found matching those filters.' }),
    );
  });

  it('includes unreleased cards when released is false', async () => {
    const interaction = makeInteraction({ released: false });
    await execute(interaction, baseCache);
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('filters by card type', async () => {
    const interaction = makeInteraction({ type: 'guts' });
    await execute(interaction, baseCache);
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });

  it('filters by welfare', async () => {
    const interaction = makeInteraction({ welfare: true });
    await execute(interaction, baseCache);
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('edits reply with embed on single page', async () => {
    const singleCache = makeCache([makeCard()]);
    const interaction = makeInteraction();
    await execute(interaction, singleCache);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });

  it('edits reply with embed and buttons on multiple pages', async () => {
    const multiCache = makeCache(
      Array.from({ length: 6 }, (_, i) => makeCard({ support_id: i + 1, char_name: `Card ${i}` })),
    );
    const interaction = makeInteraction();
    await execute(interaction, multiCache);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) }),
    );
  });

  describe('collector', () => {
    function makeCollectorInteraction() {
      const handlers: Record<string, (arg: unknown) => Promise<void>> = {};
      const mockCollector = {
        on: vi.fn((event: string, handler: (arg: unknown) => Promise<void>) => {
          handlers[event] = handler;
        }),
        stop: vi.fn(),
      };
      const interaction = makeInteraction();
      (interaction as unknown as Record<string, unknown>).channel = {
        createMessageComponentCollector: vi.fn().mockReturnValue(mockCollector),
      };
      return { interaction, handlers, mockCollector };
    }

    function makePaginatedCache() {
      return makeCache(
        Array.from({ length: 6 }, (_, i) =>
          makeCard({ support_id: i + 1, char_name: `Card ${i}` }),
        ),
      );
    }

    it('navigates to next page on next button', async () => {
      const { interaction, handlers } = makeCollectorInteraction();
      await execute(interaction, makePaginatedCache());

      const buttonInteraction = {
        customId: 'cards_next',
        user: { id: 'user-123' },
        update: vi.fn().mockResolvedValue(undefined),
      };
      await handlers['collect'](buttonInteraction);

      expect(buttonInteraction.update).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) }),
      );
    });

    it('does not go below page 0 on prev button', async () => {
      const { interaction, handlers } = makeCollectorInteraction();
      await execute(interaction, makePaginatedCache());

      const buttonInteraction = {
        customId: 'cards_prev',
        user: { id: 'user-123' },
        update: vi.fn().mockResolvedValue(undefined),
      };
      await handlers['collect'](buttonInteraction);

      expect(buttonInteraction.update).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) }),
      );
    });

    it('removes buttons when collector ends', async () => {
      const { interaction, handlers } = makeCollectorInteraction();
      await execute(interaction, makePaginatedCache());
      await handlers['end'](undefined);
      expect(interaction.editReply).toHaveBeenLastCalledWith({ components: [] });
    });

    it('filters out interactions from other users', async () => {
      const { interaction } = makeCollectorInteraction();
      await execute(interaction, makePaginatedCache());

      const channelMock = interaction.channel as unknown as Record<
        string,
        ReturnType<typeof vi.fn>
      >;
      const { filter } = channelMock.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };

      expect(filter({ customId: 'cards_next', user: { id: 'other-user' } })).toBe(false);
    });

    it('filters out interactions with wrong customId', async () => {
      const { interaction } = makeCollectorInteraction();
      await execute(interaction, makePaginatedCache());

      const channelMock = interaction.channel as unknown as Record<
        string,
        ReturnType<typeof vi.fn>
      >;
      const { filter } = channelMock.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };

      expect(filter({ customId: 'wrong_id', user: { id: 'user-123' } })).toBe(false);
    });
  });
});
