import { describe, it, expect, vi } from 'vitest';
import { ChatInputCommandInteraction, Collection } from 'discord.js';
import {
  execute,
  buildEmbed,
  buildRow,
  parseFilters,
  formatSummary,
  buildPages,
} from '../../commands/umas';
import { UmaSummary } from '../../types';
import { Fetcher } from '../../api/client';

const mockUmaSummary: UmaSummary = {
  id: 100101,
  name: 'Special Week',
  subtitle: 'default',
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
};

function makeFetcher(data: UmaSummary[]): Fetcher {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response);
}

function makeInteraction(filters?: string): ChatInputCommandInteraction {
  return {
    options: { getString: vi.fn().mockReturnValue(filters ?? null) },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    user: { id: 'user-123' },
    channel: null,
  } as unknown as ChatInputCommandInteraction;
}

describe('parseFilters', () => {
  it('parses valid filters', () => {
    expect(parseFilters('turf:A long:S')).toEqual({ turf: 'A', long: 'S' });
  });

  it('maps sprint to short', () => {
    expect(parseFilters('sprint:A')).toEqual({ short: 'A' });
  });

  it('uppercases values', () => {
    expect(parseFilters('turf:a')).toEqual({ turf: 'A' });
  });

  it('ignores unknown keys', () => {
    expect(parseFilters('unknown:A turf:S')).toEqual({ turf: 'S' });
  });

  it('ignores malformed tokens', () => {
    expect(parseFilters('turf: :A nocodon')).toEqual({});
  });
});

describe('formatSummary', () => {
  it('formats a summary correctly', () => {
    const result = formatSummary(mockUmaSummary);
    expect(result).toContain('Special Week');
    expect(result).toContain('Default');
    expect(result).toContain('Turf: A');
    expect(result).toContain('Sprint: G');
    expect(result).toContain('Front: A');
  });
});

describe('buildPages', () => {
  it('groups lines into pages of 5', () => {
    const lines = Array.from({ length: 12 }, (_, i) => `line ${i}`);
    const pages = buildPages(lines);
    expect(pages).toHaveLength(3);
  });

  it('joins lines with separator', () => {
    const pages = buildPages(['a', 'b']);
    expect(pages[0]).toContain('---');
  });
});

describe('buildEmbed', () => {
  it('sets title without filters', () => {
    const embed = buildEmbed('content', 0, 1, {});
    expect(embed.toJSON().title).toBe('Umamusume');
  });

  it('includes filters in title', () => {
    const embed = buildEmbed('content', 0, 1, { turf: 'A', long: 'S' });
    expect(embed.toJSON().title).toContain('turf: A');
    expect(embed.toJSON().title).toContain('long: S');
  });

  it('sets footer with page number and source', () => {
    const embed = buildEmbed('content', 0, 3, {});
    expect(embed.toJSON().footer?.text).toContain('Page 1 of 3');
    expect(embed.toJSON().footer?.text).toContain('gametora.com');
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

  it('enables both buttons on middle page', () => {
    const row = buildRow(1, 3);
    const components = row.toJSON().components;
    expect(components[0].disabled).toBe(false);
    expect(components[1].disabled).toBe(false);
  });
});

describe('execute', () => {
  it('replies with no results message when list is empty', async () => {
    const interaction = makeInteraction();
    await execute(interaction, makeFetcher([]));
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'No umamusume found matching those filters.' }),
    );
  });

  it('replies with single embed when results fit one page', async () => {
    const interaction = makeInteraction();
    await execute(interaction, makeFetcher([mockUmaSummary]));
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });

  it('parses filters from input and passes them to fetcher', async () => {
    const interaction = makeInteraction('turf:A');
    const fetcher = makeFetcher([mockUmaSummary]);
    await execute(interaction, fetcher);
    const calledUrl = (fetcher as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain('turf=A');
  });

  it('shows pagination when results span multiple pages', async () => {
    const manyUmas = Array.from({ length: 6 }, (_, i) => ({ ...mockUmaSummary, id: i }));
    const interaction = makeInteraction();
    await execute(interaction, makeFetcher(manyUmas));
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ components: expect.any(Array) }),
    );
  });

  describe('collector', () => {
    function makeCollectorInteraction(filters?: string): ChatInputCommandInteraction {
      const handlers: Record<string, (arg: unknown) => Promise<void>> = {};
      const mockCollector = {
        on: vi.fn((event: string, handler: (arg: unknown) => Promise<void>) => {
          handlers[event] = handler;
        }),
      };
      const interaction = makeInteraction(filters);
      (interaction as unknown as Record<string, unknown>).channel = {
        createMessageComponentCollector: vi.fn().mockReturnValue(mockCollector),
      };
      (interaction as unknown as Record<string, unknown>)._handlers = handlers;
      return interaction;
    }

    function getHandlers(
      interaction: ChatInputCommandInteraction,
    ): Record<string, (arg: unknown) => Promise<void>> {
      return (interaction as unknown as Record<string, unknown>)._handlers as Record<
        string,
        (arg: unknown) => Promise<void>
      >;
    }

    it('navigates to next page on next button', async () => {
      const manyUmas = Array.from({ length: 6 }, (_, i) => ({ ...mockUmaSummary, id: i }));
      const interaction = makeCollectorInteraction();
      await execute(interaction, makeFetcher(manyUmas));

      const handlers = getHandlers(interaction);
      const update = vi.fn().mockResolvedValue(undefined);
      await handlers['collect']({ customId: 'umas_next', user: { id: 'user-123' }, update });

      expect(update).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }));
    });

    it('navigates to prev page on prev button', async () => {
      const manyUmas = Array.from({ length: 6 }, (_, i) => ({ ...mockUmaSummary, id: i }));
      const interaction = makeCollectorInteraction();
      await execute(interaction, makeFetcher(manyUmas));

      const handlers = getHandlers(interaction);
      const update = vi.fn().mockResolvedValue(undefined);

      await handlers['collect']({ customId: 'umas_next', user: { id: 'user-123' }, update });
      await handlers['collect']({ customId: 'umas_prev', user: { id: 'user-123' }, update });

      expect(update).toHaveBeenCalledTimes(2);
    });

    it('removes components on collector end', async () => {
      const manyUmas = Array.from({ length: 6 }, (_, i) => ({ ...mockUmaSummary, id: i }));
      const interaction = makeCollectorInteraction();
      await execute(interaction, makeFetcher(manyUmas));

      const handlers = getHandlers(interaction);
      await handlers['end'](new Collection());

      expect(interaction.editReply).toHaveBeenCalledWith({ components: [] });
    });

    it('ignores interactions from other users', async () => {
      const manyUmas = Array.from({ length: 6 }, (_, i) => ({ ...mockUmaSummary, id: i }));
      const interaction = makeCollectorInteraction();
      await execute(interaction, makeFetcher(manyUmas));

      const channelMock = interaction.channel as unknown as Record<
        string,
        ReturnType<typeof vi.fn>
      >;
      const { filter } = channelMock.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };
      expect(filter({ customId: 'umas_next', user: { id: 'other-user' } })).toBe(false);
    });

    it('ignores interactions with wrong customId', async () => {
      const manyUmas = Array.from({ length: 6 }, (_, i) => ({ ...mockUmaSummary, id: i }));
      const interaction = makeCollectorInteraction();
      await execute(interaction, makeFetcher(manyUmas));

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
