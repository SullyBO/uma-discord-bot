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

function makeSelectInteraction() {
  return {
    customId: 'uma_select',
    user: { id: 'user-123' },
    values: ['100101'],
    deferUpdate: vi.fn().mockResolvedValue(undefined),
  };
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
  };
  return { fakeMessage, fakeCollector, handlers };
}

function makeInteraction(name: string) {
  const { fakeMessage: selectReplyMessage } = makeFakeMessage();
  const { fakeMessage: singleMatchMessage, fakeCollector, handlers } = makeFakeMessage();

  const followUpMessage = {
    createMessageComponentCollector: vi.fn().mockReturnValue(fakeCollector),
  };

  const interaction = {
    options: { getString: vi.fn().mockReturnValue(name) },
    reply: vi.fn().mockResolvedValue({ resource: { message: selectReplyMessage } }),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    deleteReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(followUpMessage),
    fetchReply: vi.fn().mockResolvedValue(singleMatchMessage),
    deferred: false,
    user: { id: 'user-123' },
  } as unknown as ChatInputCommandInteraction;

  return {
    interaction,
    selectReplyMessage,
    singleMatchMessage,
    followUpMessage,
    fakeCollector,
    handlers,
  };
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
    const { interaction } = makeInteraction('nonexistent');
    await execute(interaction, cache, makeFetcher(mockUmaDetail));
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No umamusume found') }),
    );
  });

  it('defers and edits reply on single match', async () => {
    const { interaction } = makeInteraction('suzuka');
    await execute(interaction, cache, makeFetcher(mockUmaDetail));
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) }),
    );
  });

  it('shows select menu on multiple matches', async () => {
    const { interaction, selectReplyMessage } = makeInteraction('special');
    selectReplyMessage.awaitMessageComponent.mockResolvedValue(makeSelectInteraction());
    await execute(interaction, cache, makeFetcher(mockUmaDetail));
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Multiple umamusume found'),
        components: expect.any(Array),
      }),
    );
  });

  describe('single match toggle collector', () => {
    it('scopes collector to the reply message, not the channel', async () => {
      const { interaction, singleMatchMessage } = makeInteraction('suzuka');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      expect(singleMatchMessage.createMessageComponentCollector).toHaveBeenCalled();
    });

    it('ignores toggle interactions from other users', async () => {
      const { interaction, singleMatchMessage } = makeInteraction('suzuka');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      const { filter } = singleMatchMessage.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };
      expect(filter({ customId: 'uma_toggle', user: { id: 'other-user' } })).toBe(false);
    });

    it('ignores toggle interactions with wrong customId', async () => {
      const { interaction, singleMatchMessage } = makeInteraction('suzuka');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      const { filter } = singleMatchMessage.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };
      expect(filter({ customId: 'wrong_id', user: { id: 'user-123' } })).toBe(false);
    });

    it('toggles to skills page on button click', async () => {
      const { interaction, handlers } = makeInteraction('suzuka');
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
      const { interaction, handlers } = makeInteraction('suzuka');
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      await handlers['end'](undefined);
      expect(interaction.editReply).toHaveBeenCalledWith({ components: [] });
    });
  });

  describe('select collector', () => {
    it('ignores interactions from other users', async () => {
      const { interaction, selectReplyMessage } = makeInteraction('special');
      selectReplyMessage.awaitMessageComponent.mockResolvedValue(makeSelectInteraction());
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      const { filter } = selectReplyMessage.awaitMessageComponent.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };
      expect(filter({ customId: 'uma_select', user: { id: 'other-user' } })).toBe(false);
    });

    it('ignores interactions with wrong customId', async () => {
      const { interaction, selectReplyMessage } = makeInteraction('special');
      selectReplyMessage.awaitMessageComponent.mockResolvedValue(makeSelectInteraction());
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      const { filter } = selectReplyMessage.awaitMessageComponent.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };
      expect(filter({ customId: 'wrong_id', user: { id: 'user-123' } })).toBe(false);
    });

    it('deletes ephemeral reply and follows up publicly on selection', async () => {
      const { interaction, selectReplyMessage } = makeInteraction('special');
      const selectInteraction = makeSelectInteraction();
      selectReplyMessage.awaitMessageComponent.mockResolvedValue(selectInteraction);
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      expect(selectInteraction.deferUpdate).toHaveBeenCalled();
      expect(interaction.deleteReply).toHaveBeenCalled();
      expect(interaction.followUp).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) }),
      );
    });

    it('edits reply with timeout message when awaitMessageComponent times out', async () => {
      const { interaction, selectReplyMessage } = makeInteraction('special');
      selectReplyMessage.awaitMessageComponent.mockRejectedValue(new Error('Collector timeout'));
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Timed out.', components: [] }),
      );
    });

    it('does not time out when user makes a selection', async () => {
      const { interaction, selectReplyMessage } = makeInteraction('special');
      selectReplyMessage.awaitMessageComponent.mockResolvedValue(makeSelectInteraction());
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      expect(interaction.editReply).not.toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Timed out.' }),
      );
    });

    it('scopes toggle collector to the follow-up message after selection', async () => {
      const { interaction, selectReplyMessage, followUpMessage } = makeInteraction('special');
      selectReplyMessage.awaitMessageComponent.mockResolvedValue(makeSelectInteraction());
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      expect(followUpMessage.createMessageComponentCollector).toHaveBeenCalled();
    });

    it('ignores toggle interactions from other users after selection', async () => {
      const { interaction, selectReplyMessage, followUpMessage } = makeInteraction('special');
      selectReplyMessage.awaitMessageComponent.mockResolvedValue(makeSelectInteraction());
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      const { filter } = followUpMessage.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };
      expect(filter({ customId: 'uma_toggle', user: { id: 'other-user' } })).toBe(false);
    });

    it('ignores toggle interactions with wrong customId after selection', async () => {
      const { interaction, selectReplyMessage, followUpMessage } = makeInteraction('special');
      selectReplyMessage.awaitMessageComponent.mockResolvedValue(makeSelectInteraction());
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      const { filter } = followUpMessage.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };
      expect(filter({ customId: 'wrong_id', user: { id: 'user-123' } })).toBe(false);
    });

    it('toggles to skills page after selecting from menu', async () => {
      const { interaction, selectReplyMessage, handlers } = makeInteraction('special');
      selectReplyMessage.awaitMessageComponent.mockResolvedValue(makeSelectInteraction());
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

    it('removes components when toggle collector ends after selection', async () => {
      const { interaction, selectReplyMessage, handlers } = makeInteraction('special');
      selectReplyMessage.awaitMessageComponent.mockResolvedValue(makeSelectInteraction());
      await execute(interaction, cache, makeFetcher(mockUmaDetail));
      await handlers['end'](undefined);
      expect(interaction.editReply).toHaveBeenCalledWith({ components: [] });
    });
  });
});
