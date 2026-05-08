import { describe, it, expect, vi } from 'vitest';
import { Collection, ChatInputCommandInteraction } from 'discord.js';
import { execute } from '../../commands/skill';
import { SkillSummary, SkillDetail } from '../../types';
import { Fetcher } from '../../api/client';

const mockSkillSummary = (overrides: Partial<SkillSummary> = {}): SkillSummary => ({
  id: 1,
  name: 'Speed Boost',
  category: 'velocity',
  rarity: 'normal',
  sp_cost: 50,
  is_jp_only: false,
  ...overrides,
});

const mockSkillDetail = (overrides: Partial<SkillDetail> = {}): SkillDetail => ({
  id: 1,
  name: 'Speed Boost',
  category: 'velocity',
  rarity: 'normal',
  sp_cost: 50,
  is_jp_only: false,
  triggers: [
    {
      id: 1,
      effects: [{ effect_type: 'Increase Current Speed', effect_value: 0.15 }],
      conditions: [{ cond_key: 'distance_type', operator: 'eq', cond_val: '3', is_or: false }],
      preconditions: [],
    },
    {
      id: 2,
      effects: [{ effect_type: 'Debuff Immunity', effect_value: null }],
      conditions: [],
      preconditions: [],
    },
    {
      id: 3,
      effects: [{ effect_type: 'Stamina Recovery', effect_value: null }],
      conditions: [],
      preconditions: [{ cond_key: 'phase', operator: 'gt_eq', cond_val: '2', is_or: false }],
    },
  ],
  ...overrides,
});

function makeFetcher(detail: SkillDetail): Fetcher {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(detail),
  } as Response);
}

function makeCache(entries: SkillSummary[]): Collection<number, SkillSummary> {
  const cache = new Collection<number, SkillSummary>();
  entries.forEach((e) => cache.set(e.id, e));
  return cache;
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

describe('execute', () => {
  const cache = makeCache([
    mockSkillSummary({ id: 1, name: 'Speed Boost' }),
    mockSkillSummary({ id: 2, name: 'Speed Up' }),
    mockSkillSummary({ id: 3, name: 'Stamina Recovery' }),
  ]);

  it('replies ephemerally when no match found', async () => {
    const interaction = makeInteraction('nonexistent');
    await execute(interaction, makeFetcher(mockSkillDetail()), cache);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No skill found') }),
    );
  });

  it('defers and edits reply on single match', async () => {
    const interaction = makeInteraction('stamina');
    await execute(interaction, makeFetcher(mockSkillDetail()), cache);
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });

  it('shows select menu on multiple matches', async () => {
    const interaction = makeInteraction('speed');
    await execute(interaction, makeFetcher(mockSkillDetail()), cache);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Multiple skills matched'),
        components: expect.any(Array),
      }),
    );
  });
  it('shows "none" for effects when trigger has no effects', async () => {
    const interaction = makeInteraction('stamina');
    const detail = mockSkillDetail({
      triggers: [{ id: 1, effects: [], conditions: [], preconditions: [] }],
    });
    await execute(interaction, makeFetcher(detail), cache);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
    );
  });

  it('shows fallback description when skill has no triggers', async () => {
    const interaction = makeInteraction('stamina');
    const detail = mockSkillDetail({ triggers: [] });
    await execute(interaction, makeFetcher(detail), cache);
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array) }),
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
      const interaction = makeInteraction('speed');
      (interaction as unknown as Record<string, unknown>).channel = {
        createMessageComponentCollector: vi.fn().mockReturnValue(mockCollector),
      };
      return { interaction, handlers, mockCollector };
    }

    it('fetches and edits reply when user selects an option', async () => {
      const { interaction, handlers } = makeCollectorInteraction();
      const fetcher = makeFetcher(mockSkillDetail());
      await execute(interaction, fetcher, cache);

      const selectInteraction = {
        customId: 'skill_select',
        user: { id: 'user-123' },
        values: ['1'],
        deferUpdate: vi.fn().mockResolvedValue(undefined),
      };

      await handlers['collect'](selectInteraction);

      expect(selectInteraction.deferUpdate).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array), components: [] }),
      );
    });

    it('filters out interactions from other users', async () => {
      const { interaction } = makeCollectorInteraction();
      await execute(interaction, makeFetcher(mockSkillDetail()), cache);

      const channelMock = interaction.channel as unknown as Record<
        string,
        ReturnType<typeof vi.fn>
      >;
      const { filter } = channelMock.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };

      expect(filter({ customId: 'skill_select', user: { id: 'other-user' } })).toBe(false);
    });

    it('filters out interactions with wrong customId', async () => {
      const { interaction } = makeCollectorInteraction();
      await execute(interaction, makeFetcher(mockSkillDetail()), cache);

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
      await execute(interaction, makeFetcher(mockSkillDetail()), cache);

      await handlers['end'](new Collection());

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Timed out.', components: [] }),
      );
    });

    it('does not edit reply with timeout when collector ends with a selection', async () => {
      const { interaction, handlers } = makeCollectorInteraction();
      await execute(interaction, makeFetcher(mockSkillDetail()), cache);

      const collected = new Collection();
      collected.set('1', {});
      await handlers['end'](collected);

      expect(interaction.editReply).not.toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Timed out.' }),
      );
    });
  });
});
