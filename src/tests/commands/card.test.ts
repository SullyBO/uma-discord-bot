import { describe, it, expect, vi } from 'vitest';
import { Collection, ChatInputCommandInteraction } from 'discord.js';
import { execute, buildSkillsEmbed, buildEffectsEmbed, buildPageRow } from '../../commands/card';
import { CardDetail, CardIndex } from '../../types';
import { Fetcher } from '../../api/client';
import type { APIButtonComponentWithCustomId } from 'discord.js';

const mockCardDetail: CardDetail = {
  support_id: 10001,
  char_name: 'Special Week',
  title: 'My Very Best',
  card_type: 'speed',
  rarity: 'ssr',
  is_welfare: false,
  release_date: '2024-01-01',
  is_predicted_date: false,
  unique_effect: 'Boost speed greatly.',
  skills: [
    { skill_id: 1, acquisition: 'event' },
    { skill_id: 2, acquisition: 'hint' },
  ],
  effects: [{ effect_name: 'Speed Bonus', lb0: 10, lb1: 20, lb2: 30, lb3: 40, mlb: 50 }],
};

const mockSkillCache = new Collection<number, { id: number; name: string }>();
mockSkillCache.set(1, { id: 1, name: 'Speed Boost' });
mockSkillCache.set(2, { id: 2, name: 'Corner Recovery' });

function makeFetcher(detail: CardDetail): Fetcher {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(detail),
  } as Response);
}

function makeCache(entries: CardIndex[]): Collection<number, CardIndex> {
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

function makeInteraction(name: string) {
  const { fakeMessage: selectReplyMessage } = makeFakeMessage();
  const { fakeMessage: fetchReplyMessage, fakeCollector, handlers } = makeFakeMessage();

  const followUpMessage = {
    createMessageComponentCollector: vi.fn().mockReturnValue(fakeCollector),
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

  return {
    interaction,
    selectReplyMessage,
    fetchReplyMessage,
    followUpMessage,
    fakeCollector,
    handlers,
  };
}

function makeSelectInteraction() {
  return {
    customId: 'card_select',
    user: { id: 'user-123' },
    values: ['10001'],
    deferUpdate: vi.fn().mockResolvedValue(undefined),
  };
}

const cache = makeCache([
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
  {
    support_id: 10002,
    char_name: 'Special Week',
    title: 'Summer Dreams',
    card_type: 'stamina',
    rarity: 'sr',
    is_welfare: false,
    release_date: null,
    is_predicted_date: false,
  },
  {
    support_id: 10003,
    char_name: 'Silence Suzuka',
    title: 'Speed of Sound',
    card_type: 'speed',
    rarity: 'ssr',
    is_welfare: false,
    release_date: '2024-03-01',
    is_predicted_date: false,
  },
]);

describe('buildSkillsEmbed', () => {
  it('sets title and URL correctly', () => {
    const embed = buildSkillsEmbed(mockCardDetail, mockSkillCache);
    const data = embed.toJSON();
    expect(data.title).toBe('My Very Best');
    expect(data.url).toBe('https://gametora.com/umamusume/supports/10001-special-week');
  });

  it('groups skills by acquisition type', () => {
    const fields = buildSkillsEmbed(mockCardDetail, mockSkillCache).toJSON().fields ?? [];
    const event = fields.find((f) => f.name === 'Event');
    const hint = fields.find((f) => f.name === 'Hint');
    expect(event?.value).toContain('Speed Boost');
    expect(hint?.value).toContain('Corner Recovery');
  });

  it('falls back to Unknown for unresolved skill ids', () => {
    const emptyCache = new Collection<number, { id: number; name: string }>();
    const fields = buildSkillsEmbed(mockCardDetail, emptyCache).toJSON().fields ?? [];
    const event = fields.find((f) => f.name === 'Event');
    expect(event?.value).toContain('Unknown (1)');
  });

  it('uses char_name as title when title is empty', () => {
    const detail = { ...mockCardDetail, title: '' };
    const embed = buildSkillsEmbed(detail, mockSkillCache);
    expect(embed.toJSON().title).toBe('Special Week');
  });
});

describe('buildEffectsEmbed', () => {
  // LB_LABELS in source: lb0 -> '0LB', lb1 -> '1LB', etc.
  it('shows effects at the given lb level', () => {
    const embed = buildEffectsEmbed(mockCardDetail, 'lb0');
    const fields = embed.toJSON().fields ?? [];
    const effectsField = fields.find((f) => f.name === 'Effects at 0LB');
    expect(effectsField?.value).toContain('Speed Bonus');
    expect(effectsField?.value).toContain('10');
  });

  it('shows unique effect for non-welfare cards at all lb levels', () => {
    const embed = buildEffectsEmbed(mockCardDetail, 'lb0');
    const fields = embed.toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Unique Effect')).toBeDefined();
  });

  it('shows unique effect for welfare cards only at lb2 and above', () => {
    const welfareCard = { ...mockCardDetail, is_welfare: true };
    const lb1Embed = buildEffectsEmbed(welfareCard, 'lb1');
    const mlbEmbed = buildEffectsEmbed(welfareCard, 'mlb');
    expect(
      (lb1Embed.toJSON().fields ?? []).find((f) => f.name === 'Unique Effect'),
    ).toBeUndefined();
    expect((mlbEmbed.toJSON().fields ?? []).find((f) => f.name === 'Unique Effect')).toBeDefined();
  });

  it('shows no effects message when effects list is empty', () => {
    const detail = { ...mockCardDetail, effects: [] };
    const embed = buildEffectsEmbed(detail, 'lb0');
    const fields = embed.toJSON().fields ?? [];
    const effectsField = fields.find((f) => f.name === 'Effects at 0LB');
    expect(effectsField?.value).toBe('No effects.');
  });

  it('shows dash when lb value is null', () => {
    const detail = {
      ...mockCardDetail,
      effects: [
        {
          effect_name: 'Speed Bonus',
          lb0: null,
          lb1: null,
          lb2: null,
          lb3: null,
          mlb: null,
        },
      ],
    };
    const embed = buildEffectsEmbed(detail, 'lb0');
    const fields = embed.toJSON().fields ?? [];
    const effectsField = fields.find((f) => f.name === 'Effects at 0LB');
    expect(effectsField?.value).toContain('-');
  });

  it('includes footer with page label', () => {
    const embed = buildEffectsEmbed(mockCardDetail, 'mlb');
    expect(embed.toJSON().footer?.text).toContain('Effects (MLB)');
  });
});

describe('buildPageRow', () => {
  it('shows browse button on skills page', () => {
    const components = buildPageRow('skills').toJSON().components;
    const labels = components.map((c) => (c as APIButtonComponentWithCustomId).label);
    expect(labels).toContain('View a Skill');
  });

  it('does not show browse button on effect pages', () => {
    const components = buildPageRow('lb0').toJSON().components;
    const labels = components.map((c) => (c as APIButtonComponentWithCustomId).label);
    expect(labels).not.toContain('View a Skill');
  });

  it('prev button wraps to last page from skills', () => {
    const components = buildPageRow('skills').toJSON().components;
    // prevPage from 'skills' is 'mlb', label is '← MLB'
    expect((components[0] as APIButtonComponentWithCustomId).label).toContain('MLB');
  });

  it('next button advances from skills to lb0', () => {
    const components = buildPageRow('skills').toJSON().components;
    // nextPage from 'skills' is 'lb0', label is '0LB →'
    expect((components[1] as APIButtonComponentWithCustomId).label).toContain('0LB');
  });
});

describe('execute', () => {
  it('replies ephemerally when no match found', async () => {
    const { interaction } = makeInteraction('nonexistent');
    await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No support card found') }),
    );
  });

  it('defers and edits reply on single match', async () => {
    const { interaction } = makeInteraction('suzuka');
    await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) }),
    );
  });

  it('shows select menu on multiple matches', async () => {
    const { interaction, selectReplyMessage } = makeInteraction('special');
    selectReplyMessage.awaitMessageComponent.mockResolvedValue(makeSelectInteraction());
    await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Multiple cards found'),
        components: expect.any(Array),
      }),
    );
  });

  describe('single match collector', () => {
    it('scopes collector to the reply message, not the channel', async () => {
      const { interaction, fetchReplyMessage } = makeInteraction('suzuka');
      await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));
      expect(fetchReplyMessage.createMessageComponentCollector).toHaveBeenCalled();
    });

    it('ignores interactions from other users', async () => {
      const { interaction, fetchReplyMessage } = makeInteraction('suzuka');
      await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));
      const { filter } = fetchReplyMessage.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };
      expect(filter({ customId: 'card_next', user: { id: 'other-user' } })).toBe(false);
    });

    it('ignores interactions with wrong customId', async () => {
      const { interaction, fetchReplyMessage } = makeInteraction('suzuka');
      await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));
      const { filter } = fetchReplyMessage.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };
      expect(filter({ customId: 'wrong_id', user: { id: 'user-123' } })).toBe(false);
    });

    it('navigates to next page on next button', async () => {
      const { interaction, handlers } = makeInteraction('suzuka');
      await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));

      const buttonInteraction = {
        customId: 'card_next',
        user: { id: 'user-123' },
        update: vi.fn().mockResolvedValue(undefined),
      };
      await handlers['collect'](buttonInteraction);

      expect(buttonInteraction.update).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) }),
      );
    });

    it('navigates to prev page on prev button', async () => {
      const { interaction, handlers } = makeInteraction('suzuka');
      await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));

      const buttonInteraction = {
        customId: 'card_prev',
        user: { id: 'user-123' },
        update: vi.fn().mockResolvedValue(undefined),
      };
      await handlers['collect'](buttonInteraction);

      expect(buttonInteraction.update).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) }),
      );
    });

    it('removes components when collector ends', async () => {
      const { interaction, handlers } = makeInteraction('suzuka');
      await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));
      await handlers['end'](undefined);
      expect(interaction.editReply).toHaveBeenCalledWith({ components: [] });
    });
  });

  describe('select collector', () => {
    it('ignores interactions from other users', async () => {
      const { interaction, selectReplyMessage } = makeInteraction('special');
      selectReplyMessage.awaitMessageComponent.mockResolvedValue(makeSelectInteraction());
      await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));
      const { filter } = selectReplyMessage.awaitMessageComponent.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };
      expect(filter({ customId: 'card_select', user: { id: 'other-user' } })).toBe(false);
    });

    it('ignores interactions with wrong customId', async () => {
      const { interaction, selectReplyMessage } = makeInteraction('special');
      selectReplyMessage.awaitMessageComponent.mockResolvedValue(makeSelectInteraction());
      await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));
      const { filter } = selectReplyMessage.awaitMessageComponent.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };
      expect(filter({ customId: 'wrong_id', user: { id: 'user-123' } })).toBe(false);
    });

    it('deletes ephemeral reply and follows up publicly on selection', async () => {
      const { interaction, selectReplyMessage } = makeInteraction('special');
      const selectInteraction = makeSelectInteraction();
      selectReplyMessage.awaitMessageComponent.mockResolvedValue(selectInteraction);
      await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));
      expect(selectInteraction.deferUpdate).toHaveBeenCalled();
      expect(interaction.deleteReply).toHaveBeenCalled();
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) }),
      );
    });

    it('edits reply with timeout message when awaitMessageComponent times out', async () => {
      const { interaction, selectReplyMessage } = makeInteraction('special');
      selectReplyMessage.awaitMessageComponent.mockRejectedValue(new Error('Collector timeout'));
      await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Timed out.', components: [] }),
      );
    });

    it('scopes toggle collector to the follow-up message after selection', async () => {
      const { interaction, selectReplyMessage, followUpMessage } = makeInteraction('special');
      selectReplyMessage.awaitMessageComponent.mockResolvedValue(makeSelectInteraction());
      await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));
      expect(followUpMessage.createMessageComponentCollector).toHaveBeenCalled();
    });

    it('ignores toggle interactions from other users after selection', async () => {
      const { interaction, selectReplyMessage, followUpMessage } = makeInteraction('special');
      selectReplyMessage.awaitMessageComponent.mockResolvedValue(makeSelectInteraction());
      await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));
      const { filter } = followUpMessage.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };
      expect(filter({ customId: 'card_next', user: { id: 'other-user' } })).toBe(false);
    });

    it('ignores toggle interactions with wrong customId after selection', async () => {
      const { interaction, selectReplyMessage, followUpMessage } = makeInteraction('special');
      selectReplyMessage.awaitMessageComponent.mockResolvedValue(makeSelectInteraction());
      await execute(interaction, cache, mockSkillCache, makeFetcher(mockCardDetail));
      const { filter } = followUpMessage.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };
      expect(filter({ customId: 'wrong_id', user: { id: 'user-123' } })).toBe(false);
    });
  });
});
