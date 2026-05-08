import { describe, it, expect, vi } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';
import {
  buildEmbed,
  buildPages,
  buildParams,
  buildRow,
  execute,
  formatSummary,
} from '../../commands/skills';
import { SkillSummary } from '../../types';
import { Fetcher } from '../../api/client';

const mockSkill = (overrides: Partial<SkillSummary> = {}): SkillSummary => ({
  id: 1,
  name: 'Speed Boost',
  category: 'velocity',
  rarity: 'normal',
  sp_cost: 50,
  is_jp_only: false,
  ...overrides,
});

function makeFetcher(skills: SkillSummary[]): Fetcher {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(skills),
  } as Response);
}

function makeInteraction(options: Record<string, string | null> = {}): ChatInputCommandInteraction {
  return {
    options: {
      getString: vi.fn((key: string) => options[key] ?? null),
    },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    deferred: false,
    user: { id: 'user-123' },
    channel: null,
  } as unknown as ChatInputCommandInteraction;
}

describe('formatSummary', () => {
  it('formats skill name in bold', () => {
    const result = formatSummary(mockSkill());
    expect(result).toContain('**Speed Boost**');
  });

  it('includes category, rarity, and sp_cost', () => {
    const result = formatSummary(mockSkill());
    expect(result).toContain('Category: velocity');
    expect(result).toContain('Rarity: normal');
    expect(result).toContain('SP: 50');
  });
});

describe('buildPages', () => {
  it('puts up to 5 items per page', () => {
    const lines = Array.from({ length: 5 }, (_, i) => `skill ${i}`);
    const pages = buildPages(lines);
    expect(pages).toHaveLength(1);
  });

  it('splits into multiple pages when over 5 items', () => {
    const lines = Array.from({ length: 6 }, (_, i) => `skill ${i}`);
    const pages = buildPages(lines);
    expect(pages).toHaveLength(2);
  });

  it('joins items within a page with separator', () => {
    const lines = ['a', 'b'];
    const pages = buildPages(lines);
    expect(pages[0]).toContain('a\n---\nb');
  });

  it('returns empty array for empty input', () => {
    expect(buildPages([])).toHaveLength(0);
  });
});

describe('buildParams', () => {
  it('returns empty object when no options provided', () => {
    const interaction = makeInteraction();
    expect(buildParams(interaction)).toEqual({});
  });

  it('includes category when provided', () => {
    const interaction = makeInteraction({ category: 'Velocity' });
    expect(buildParams(interaction)).toMatchObject({ category: 'velocity' });
  });

  it('includes rarity when provided', () => {
    const interaction = makeInteraction({ rarity: 'Rare' });
    expect(buildParams(interaction)).toMatchObject({ rarity: 'rare' });
  });

  it('includes effect_type when provided', () => {
    const interaction = makeInteraction({ effect_type: 'Speed Stat Up' });
    expect(buildParams(interaction)).toMatchObject({ effect_type: 'speed stat up' });
  });

  it('lowercases all values', () => {
    const interaction = makeInteraction({ category: 'VELOCITY', rarity: 'RARE' });
    const params = buildParams(interaction);
    expect(params.category).toBe('velocity');
    expect(params.rarity).toBe('rare');
  });
});

describe('buildEmbed', () => {
  it('sets title to Skills when no filters', () => {
    const embed = buildEmbed('page content', 0, 1, {});
    expect(embed.toJSON().title).toBe('Skills');
  });

  it('includes filter summary in title', () => {
    const embed = buildEmbed('page content', 0, 1, { category: 'velocity' });
    expect(embed.toJSON().title).toBe('Skills — category: velocity');
  });

  it('excludes is_jp_only from title', () => {
    const embed = buildEmbed('page content', 0, 1, { is_jp_only: false });
    expect(embed.toJSON().title).toBe('Skills');
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
    const row = buildRow(0, 3);
    const components = row.toJSON().components;
    expect(components[0].disabled).toBe(true);
    expect(components[1].disabled).toBe(false);
  });

  it('disables next button on last page', () => {
    const row = buildRow(2, 3);
    const components = row.toJSON().components;
    expect(components[0].disabled).toBe(false);
    expect(components[1].disabled).toBe(true);
  });

  it('enables both buttons on a middle page', () => {
    const row = buildRow(1, 3);
    const components = row.toJSON().components;
    expect(components[0].disabled).toBe(false);
    expect(components[1].disabled).toBe(false);
  });
});

describe('execute', () => {
  it('defers reply on invocation', async () => {
    const interaction = makeInteraction();
    await execute(interaction, makeFetcher([mockSkill()]));
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('edits reply with no results message when skills is empty', async () => {
    const interaction = makeInteraction();
    await execute(interaction, makeFetcher([]));
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'No skills found matching those filters.' }),
    );
  });

  it('edits reply with embed when single page', async () => {
    const interaction = makeInteraction();
    await execute(interaction, makeFetcher([mockSkill()]));
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });

  it('edits reply with embed and buttons when multiple pages', async () => {
    const skills = Array.from({ length: 6 }, (_, i) => mockSkill({ id: i, name: `Skill ${i}` }));
    const interaction = makeInteraction();
    await execute(interaction, makeFetcher(skills));
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
        components: expect.any(Array),
      }),
    );
  });

  describe('collector', () => {
    function makeCollectorInteraction(options: Record<string, string | null> = {}) {
      const handlers: Record<string, (arg: unknown) => Promise<void>> = {};
      const mockCollector = {
        on: vi.fn((event: string, handler: (arg: unknown) => Promise<void>) => {
          handlers[event] = handler;
        }),
      };
      const interaction = makeInteraction(options);
      (interaction as unknown as Record<string, unknown>).channel = {
        createMessageComponentCollector: vi.fn().mockReturnValue(mockCollector),
      };
      return { interaction, handlers, mockCollector };
    }

    function makePaginatedFetcher() {
      return makeFetcher(
        Array.from({ length: 6 }, (_, i) => mockSkill({ id: i, name: `Skill ${i}` })),
      );
    }

    it('navigates to next page on next button', async () => {
      const { interaction, handlers } = makeCollectorInteraction();
      await execute(interaction, makePaginatedFetcher());

      await handlers['collect']({
        customId: 'skills_next',
        user: { id: 'user-123' },
        update: vi.fn().mockResolvedValue(undefined),
      });

      expect(interaction.editReply).toHaveBeenCalledTimes(1);
    });

    it('does not go below page 0 on prev button', async () => {
      const { interaction, handlers } = makeCollectorInteraction();
      await execute(interaction, makePaginatedFetcher());

      const buttonInteraction = {
        customId: 'skills_prev',
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
      await execute(interaction, makePaginatedFetcher());

      await handlers['end'](undefined);

      expect(interaction.editReply).toHaveBeenLastCalledWith({ components: [] });
    });

    it('filters out interactions from other users', async () => {
      const { interaction } = makeCollectorInteraction();
      await execute(interaction, makePaginatedFetcher());

      const channelMock = interaction.channel as unknown as Record<
        string,
        ReturnType<typeof vi.fn>
      >;
      const { filter } = channelMock.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };

      expect(filter({ customId: 'skills_next', user: { id: 'other-user' } })).toBe(false);
    });

    it('filters out interactions with wrong customId', async () => {
      const { interaction } = makeCollectorInteraction();
      await execute(interaction, makePaginatedFetcher());

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
