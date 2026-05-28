import { describe, it, expect, vi } from 'vitest';
import {
  Collection,
  ChatInputCommandInteraction,
  APIButtonComponentWithCustomId,
} from 'discord.js';
import {
  execute,
  buildSkillDetailEmbed,
  buildSkillAcquisitionsEmbed,
  buildSkillPageButtons,
} from '../../commands/skill';
import { CardIndex, SkillDetail, SkillSummary, UmaIndex } from '../../types';
import { Fetcher } from '../../api/client';

const mockSkillSummary = (overrides: Partial<SkillSummary> = {}): SkillSummary => ({
  id: 1,
  name: 'Speed Boost',
  category: 'velocity',
  rarity: 'normal',
  sp_cost: 50,
  is_jp_only: false,
  ingame_description: 'Increases speed for a short duration.',
  ...overrides,
});

const mockSkillDetail = (overrides: Partial<SkillDetail> = {}): SkillDetail => ({
  id: 1,
  name: 'Speed Boost',
  category: 'velocity',
  rarity: 'normal',
  sp_cost: 50,
  is_jp_only: false,
  ingame_description: 'Increases speed for a short duration.',
  inherited_skill: null,
  acquisitions: [],
  triggers: [
    {
      id: 1,
      duration: 5,
      effects: [{ effect_type: 'Increase Current Speed', effect_value: 0.15 }],
      conditions: [{ cond_key: 'distance_type', operator: 'eq', cond_val: '3', is_or: false }],
      preconditions: [],
      scaling: null,
    },
    {
      id: 2,
      duration: null,
      effects: [{ effect_type: 'Debuff Immunity', effect_value: null }],
      conditions: [],
      preconditions: [],
      scaling: null,
    },
    {
      id: 3,
      duration: 3,
      effects: [{ effect_type: 'Stamina Recovery', effect_value: null }],
      conditions: [],
      preconditions: [{ cond_key: 'phase', operator: 'gt_eq', cond_val: '2', is_or: false }],
      scaling: null,
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

function makeSkillCache(entries: SkillSummary[]): Collection<number, SkillSummary> {
  const cache = new Collection<number, SkillSummary>();
  entries.forEach((e) => cache.set(e.id, e));
  return cache;
}

function makeUmaCache(entries: UmaIndex[]): Collection<number, UmaIndex> {
  const cache = new Collection<number, UmaIndex>();
  entries.forEach((e) => cache.set(e.id, e));
  return cache;
}

function makeCardCache(entries: CardIndex[]): Collection<number, CardIndex> {
  const cache = new Collection<number, CardIndex>();
  entries.forEach((e) => cache.set(e.support_id, e));
  return cache;
}

function makeFakeMessage() {
  const handlers: Record<string, (...args: unknown[]) => Promise<void>> = {};
  const fakeCollector = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => Promise<void>) => {
      handlers[event] = handler;
    }),
  };
  const fakeMessage = {
    createMessageComponentCollector: vi.fn().mockReturnValue(fakeCollector),
    awaitMessageComponent: vi.fn(),
    edit: vi.fn().mockResolvedValue(undefined),
  };
  return { fakeMessage, fakeCollector, handlers };
}

function makeInteraction(name: string): ChatInputCommandInteraction {
  const { fakeMessage: selectReplyMessage } = makeFakeMessage();
  const { fakeMessage: fetchReplyMessage, handlers } = makeFakeMessage();
  const followUpMessage = {
    createMessageComponentCollector: vi.fn().mockReturnValue({ on: vi.fn() }),
    edit: vi.fn().mockResolvedValue(undefined),
  };

  const interaction = {
    options: { getString: vi.fn().mockReturnValue(name) },
    reply: vi.fn().mockResolvedValue({ resource: { message: selectReplyMessage } }),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    deleteReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(followUpMessage),
    fetchReply: vi.fn().mockResolvedValue(fetchReplyMessage),
    deferred: false,
    user: { id: 'user-123' },
  } as unknown as ChatInputCommandInteraction;

  return Object.assign(interaction, {
    _fetchReplyMessage: fetchReplyMessage,
    _handlers: handlers,
    _selectReplyMessage: selectReplyMessage,
    _followUpMessage: followUpMessage,
  });
}

function makeSelectComponentInteraction(valueId: string = '1') {
  return {
    customId: 'skill_select',
    user: { id: 'user-123' },
    values: [valueId],
    deferUpdate: vi.fn().mockResolvedValue(undefined),
  };
}

function makeCollectorInteraction(
  selectInteraction: ReturnType<typeof makeSelectComponentInteraction>,
) {
  const interaction = makeInteraction('speed');
  const fakeMessage = {
    awaitMessageComponent: vi.fn().mockResolvedValue(selectInteraction),
    edit: vi.fn().mockResolvedValue(undefined),
  };
  (interaction.reply as ReturnType<typeof vi.fn>).mockResolvedValue({
    resource: { message: fakeMessage },
  });
  return { interaction, fakeMessage };
}

function makeTimedOutInteraction() {
  const interaction = makeInteraction('speed');
  const fakeMessage = {
    awaitMessageComponent: vi.fn().mockRejectedValue(new Error('Collector timeout')),
    edit: vi.fn().mockResolvedValue(undefined),
  };
  (interaction.reply as ReturnType<typeof vi.fn>).mockResolvedValue({
    resource: { message: fakeMessage },
  });
  return interaction;
}

const emptyUmas = makeUmaCache([]);
const emptyCards = makeCardCache([]);

const mockUmas = makeUmaCache([
  { id: 1, name: 'Special Week', version: 'default' },
  { id: 2, name: 'Silence Suzuka', version: 'summer' },
]);

const mockCards = makeCardCache([
  {
    support_id: 10001,
    char_name: 'Special Week',
    title: 'My Very Best',
    card_type: 'speed',
    rarity: 'ssr',
    is_welfare: false,
    release_date: '2024-01-01',
    is_predicted_date: false,
  },
]);

describe('buildSkillDetailEmbed', () => {
  it('sets title to skill name', () => {
    const embed = buildSkillDetailEmbed(mockSkillDetail());
    expect(embed.toJSON().title).toBe('Speed Boost');
  });

  it('sets description to ingame_description', () => {
    const embed = buildSkillDetailEmbed(mockSkillDetail());
    expect(embed.toJSON().description).toBe('Increases speed for a short duration.');
  });

  it('sets description to null when ingame_description is empty', () => {
    const embed = buildSkillDetailEmbed(mockSkillDetail({ ingame_description: '' }));
    expect(embed.toJSON().description).toBeUndefined();
  });

  it('capitalizes category and rarity', () => {
    const fields = buildSkillDetailEmbed(mockSkillDetail()).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Category')?.value).toBe('Velocity');
    expect(fields.find((f) => f.name === 'Rarity')?.value).toBe('Normal');
  });

  it('includes sp_cost field when sp_cost is greater than zero', () => {
    const fields = buildSkillDetailEmbed(mockSkillDetail()).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'SP Cost')?.value).toBe('50');
  });

  it('omits sp_cost field when sp_cost is zero', () => {
    const fields = buildSkillDetailEmbed(mockSkillDetail({ sp_cost: 0 })).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'SP Cost')).toBeUndefined();
  });

  it('shows infinite duration when duration is null', () => {
    const detail = mockSkillDetail({
      triggers: [
        { id: 1, duration: null, effects: [], conditions: [], preconditions: [], scaling: null },
      ],
    });
    const fields = buildSkillDetailEmbed(detail).toJSON().fields ?? [];
    const triggerField = fields.find((f) => f.name === '');
    expect(triggerField?.value).toContain('Infinite');
  });

  it('shows instant duration when duration is zero', () => {
    const detail = mockSkillDetail({
      triggers: [
        { id: 1, duration: 0, effects: [], conditions: [], preconditions: [], scaling: null },
      ],
    });
    const fields = buildSkillDetailEmbed(detail).toJSON().fields ?? [];
    const triggerField = fields.find((f) => f.name === '');
    expect(triggerField?.value).toContain('Instant');
  });

  it('shows numeric duration with s suffix', () => {
    const detail = mockSkillDetail({
      triggers: [
        { id: 1, duration: 3.5, effects: [], conditions: [], preconditions: [], scaling: null },
      ],
    });
    const fields = buildSkillDetailEmbed(detail).toJSON().fields ?? [];
    const triggerField = fields.find((f) => f.name === '');
    expect(triggerField?.value).toContain('3.5s');
  });

  it('shows none for effects when trigger has no effects', () => {
    const detail = mockSkillDetail({
      triggers: [
        { id: 1, duration: 5, effects: [], conditions: [], preconditions: [], scaling: null },
      ],
    });
    const fields = buildSkillDetailEmbed(detail).toJSON().fields ?? [];
    const triggerField = fields.find((f) => f.name === '');
    expect(triggerField?.value).toContain('none');
  });

  it('includes scaling when present', () => {
    const detail = mockSkillDetail({
      triggers: [
        { id: 1, duration: 5, effects: [], conditions: [], preconditions: [], scaling: 'linear' },
      ],
    });
    const fields = buildSkillDetailEmbed(detail).toJSON().fields ?? [];
    const triggerField = fields.find((f) => f.name === '');
    expect(triggerField?.value).toContain('Special Scaling');
    expect(triggerField?.value).toContain('linear');
  });

  it('includes conditions when present', () => {
    const detail = mockSkillDetail({
      triggers: [
        {
          id: 1,
          duration: 5,
          effects: [],
          scaling: null,
          preconditions: [],
          conditions: [{ cond_key: 'distance_type', operator: 'eq', cond_val: '3', is_or: false }],
        },
      ],
    });
    const fields = buildSkillDetailEmbed(detail).toJSON().fields ?? [];
    const triggerField = fields.find((f) => f.name === '');
    expect(triggerField?.value).toContain('Conditions');
  });

  it('includes preconditions when present', () => {
    const detail = mockSkillDetail({
      triggers: [
        {
          id: 1,
          duration: 5,
          effects: [],
          scaling: null,
          conditions: [],
          preconditions: [{ cond_key: 'phase', operator: 'gt_eq', cond_val: '2', is_or: false }],
        },
      ],
    });
    const fields = buildSkillDetailEmbed(detail).toJSON().fields ?? [];
    const triggerField = fields.find((f) => f.name === '');
    expect(triggerField?.value).toContain('Preconditions');
  });

  it('omits trigger field when triggers is empty', () => {
    const fields = buildSkillDetailEmbed(mockSkillDetail({ triggers: [] })).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === '')).toBeUndefined();
  });

  it('sets footer with detail page label', () => {
    const embed = buildSkillDetailEmbed(mockSkillDetail());
    expect(embed.toJSON().footer?.text).toContain('Detail page');
  });
});

describe('buildSkillAcquisitionsEmbed', () => {
  it('sets title to skill name', () => {
    const embed = buildSkillAcquisitionsEmbed(mockSkillDetail(), emptyUmas, emptyCards);
    expect(embed.toJSON().title).toBe('Speed Boost');
  });

  it('sets footer with acquisitions page label', () => {
    const embed = buildSkillAcquisitionsEmbed(mockSkillDetail(), emptyUmas, emptyCards);
    expect(embed.toJSON().footer?.text).toContain('Acquisitions page');
  });

  it('shows no acquisition data message when acquisitions is empty', () => {
    const fields =
      buildSkillAcquisitionsEmbed(mockSkillDetail(), emptyUmas, emptyCards).toJSON().fields ?? [];
    expect(fields[0].value).toContain('No acquisition data available.');
  });

  it('groups uma acquisitions by acquisition type', () => {
    const detail = mockSkillDetail({
      acquisitions: [
        { source_id: 1, source_type: 'uma', acquisition: 'innate' },
        { source_id: 2, source_type: 'uma', acquisition: 'innate' },
      ],
    });
    const fields = buildSkillAcquisitionsEmbed(detail, mockUmas, emptyCards).toJSON().fields ?? [];
    const umaField = fields.find((f) => f.name === 'Builtin for Umas');
    expect(umaField?.value).toContain('via innate:');
    expect(umaField?.value).toContain('Special Week');
    expect(umaField?.value).toContain('Silence Suzuka');
  });

  it('groups support card acquisitions by acquisition type', () => {
    const detail = mockSkillDetail({
      acquisitions: [{ source_id: 10001, source_type: 'support_card', acquisition: 'hint' }],
    });
    const fields = buildSkillAcquisitionsEmbed(detail, emptyUmas, mockCards).toJSON().fields ?? [];
    const cardField = fields.find((f) => f.name === 'Acquired by Support Cards');
    expect(cardField?.value).toContain('via hint:');
    expect(cardField?.value).toContain('Special Week');
  });

  it('shows unknown uma when id not in cache', () => {
    const detail = mockSkillDetail({
      acquisitions: [{ source_id: 9999, source_type: 'uma', acquisition: 'innate' }],
    });
    const fields = buildSkillAcquisitionsEmbed(detail, emptyUmas, emptyCards).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Builtin for Umas')?.value).toContain('Unknown Uma #9999');
  });

  it('shows unknown card when id not in cache', () => {
    const detail = mockSkillDetail({
      acquisitions: [{ source_id: 9999, source_type: 'support_card', acquisition: 'hint' }],
    });
    const fields = buildSkillAcquisitionsEmbed(detail, emptyUmas, emptyCards).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Acquired by Support Cards')?.value).toContain(
      'Unknown Card #9999',
    );
  });

  it('renders both uma and card fields when both are present', () => {
    const detail = mockSkillDetail({
      acquisitions: [
        { source_id: 1, source_type: 'uma', acquisition: 'innate' },
        { source_id: 10001, source_type: 'support_card', acquisition: 'hint' },
      ],
    });
    const fields = buildSkillAcquisitionsEmbed(detail, mockUmas, mockCards).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Builtin for Umas')).toBeDefined();
    expect(fields.find((f) => f.name === 'Acquired by Support Cards')).toBeDefined();
  });
});

describe('buildSkillPageButtons', () => {
  it('shows Acquisitions button on detail page', () => {
    const components = buildSkillPageButtons('detail', false, []).toJSON().components;
    expect((components[0] as APIButtonComponentWithCustomId).custom_id).toBe('skill_detail');
    const acqButton = components.find(
      (c) => (c as APIButtonComponentWithCustomId).custom_id === 'skill_acquisitions',
    );
    expect(acqButton).toBeDefined();
  });

  it('shows Detail button on acquisitions page', () => {
    const components = buildSkillPageButtons('acquisitions', false, []).toJSON().components;
    const detailButton = components.find(
      (c) => (c as APIButtonComponentWithCustomId).custom_id === 'skill_detail',
    );
    expect(detailButton).toBeDefined();
  });

  it('includes inherited skill button when hasInherited is true', () => {
    const components = buildSkillPageButtons('detail', true, []).toJSON().components;
    const inheritedButton = components.find(
      (c) => (c as APIButtonComponentWithCustomId).custom_id === 'skill_inherited',
    );
    expect(inheritedButton).toBeDefined();
  });

  it('omits inherited skill button when hasInherited is false', () => {
    const components = buildSkillPageButtons('detail', false, []).toJSON().components;
    const inheritedButton = components.find(
      (c) => (c as APIButtonComponentWithCustomId).custom_id === 'skill_inherited',
    );
    expect(inheritedButton).toBeUndefined();
  });
});

describe('execute', () => {
  const cache = makeSkillCache([
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

  it('attaches collector to fetchReply message on single match', async () => {
    const interaction = makeInteraction('stamina');
    const { _fetchReplyMessage } = interaction as unknown as {
      _fetchReplyMessage: { createMessageComponentCollector: ReturnType<typeof vi.fn> };
    };
    await execute(interaction, makeFetcher(mockSkillDetail()), cache);
    expect(_fetchReplyMessage.createMessageComponentCollector).toHaveBeenCalled();
  });

  it('scopes collector to correct user on single match', async () => {
    const interaction = makeInteraction('stamina');
    const { _fetchReplyMessage } = interaction as unknown as {
      _fetchReplyMessage: { createMessageComponentCollector: ReturnType<typeof vi.fn> };
    };
    await execute(interaction, makeFetcher(mockSkillDetail()), cache);
    const { filter } = _fetchReplyMessage.createMessageComponentCollector.mock.calls[0][0] as {
      filter: (i: unknown) => boolean;
    };
    expect(filter({ customId: 'skill_acquisitions', user: { id: 'user-123' } })).toBe(true);
    expect(filter({ customId: 'skill_acquisitions', user: { id: 'other-user' } })).toBe(false);
  });

  it('toggles to acquisitions page on button click', async () => {
    const interaction = makeInteraction('stamina');
    const { _handlers } = interaction as unknown as {
      _handlers: Record<string, (i: unknown) => Promise<void>>;
    };
    await execute(interaction, makeFetcher(mockSkillDetail()), cache);

    const buttonInteraction = {
      customId: 'skill_acquisitions',
      user: { id: 'user-123' },
      update: vi.fn().mockResolvedValue(undefined),
    };
    await _handlers['collect'](buttonInteraction);

    expect(buttonInteraction.update).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) }),
    );
  });

  it('removes components when collector ends on single match', async () => {
    const interaction = makeInteraction('stamina');
    const { _fetchReplyMessage, _handlers } = interaction as unknown as {
      _fetchReplyMessage: { edit: ReturnType<typeof vi.fn> };
      _handlers: Record<string, (i: unknown) => Promise<void>>;
    };
    await execute(interaction, makeFetcher(mockSkillDetail()), cache);
    await _handlers['end'](undefined);
    expect(_fetchReplyMessage.edit).toHaveBeenCalledWith({ components: [] });
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
      triggers: [
        { id: 1, duration: 5, effects: [], conditions: [], preconditions: [], scaling: null },
      ],
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
    it('defers, deletes ephemeral reply, and follows up publicly on selection', async () => {
      const selectInteraction = makeSelectComponentInteraction('1');
      const { interaction } = makeCollectorInteraction(selectInteraction);

      await execute(interaction, makeFetcher(mockSkillDetail()), cache);

      expect(selectInteraction.deferUpdate).toHaveBeenCalled();
      expect(interaction.deleteReply).toHaveBeenCalled();
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array) }),
      );
    });

    it('attaches collector to followUp message after selection', async () => {
      const selectInteraction = makeSelectComponentInteraction('1');
      const { interaction } = makeCollectorInteraction(selectInteraction);
      const { _followUpMessage } = interaction as unknown as {
        _followUpMessage: { createMessageComponentCollector: ReturnType<typeof vi.fn> };
      };

      await execute(interaction, makeFetcher(mockSkillDetail()), cache);

      expect(_followUpMessage.createMessageComponentCollector).toHaveBeenCalled();
    });

    it('filters out interactions from other users', async () => {
      const selectInteraction = makeSelectComponentInteraction();
      const { interaction, fakeMessage } = makeCollectorInteraction(selectInteraction);

      await execute(interaction, makeFetcher(mockSkillDetail()), cache);

      const { filter } = (fakeMessage.awaitMessageComponent as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { filter: (i: unknown) => boolean };

      expect(filter({ customId: 'skill_select', user: { id: 'other-user' } })).toBe(false);
    });

    it('filters out interactions with wrong customId', async () => {
      const selectInteraction = makeSelectComponentInteraction();
      const { interaction, fakeMessage } = makeCollectorInteraction(selectInteraction);

      await execute(interaction, makeFetcher(mockSkillDetail()), cache);

      const { filter } = (fakeMessage.awaitMessageComponent as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as { filter: (i: unknown) => boolean };

      expect(filter({ customId: 'wrong_id', user: { id: 'user-123' } })).toBe(false);
    });

    it('edits reply with timeout message when awaitMessageComponent times out', async () => {
      const interaction = makeTimedOutInteraction();

      await execute(interaction, makeFetcher(mockSkillDetail()), cache);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Timed out.', components: [] }),
      );
    });

    it('does not follow up publicly when awaitMessageComponent times out', async () => {
      const interaction = makeTimedOutInteraction();

      await execute(interaction, makeFetcher(mockSkillDetail()), cache);

      expect(interaction.followUp).not.toHaveBeenCalled();
    });
  });
});
