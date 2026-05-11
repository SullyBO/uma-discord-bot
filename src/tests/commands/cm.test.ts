import { describe, it, expect, vi } from 'vitest';
import { ChatInputCommandInteraction } from 'discord.js';
import { buildEmbed, buildRow, execute } from '../../commands/cm';
import { CM } from '../../types';

const mockCM = (overrides: Partial<CM> = {}): CM => ({
  id: 1,
  name: 'タウラス杯',
  name_en: 'Taurus Cup',
  resource_id: 5,
  start: 1620961200,
  end: 1621479599,
  race: {
    condition: 1,
    distance: 2400,
    ground: 1,
    season: 1,
    track: 10006,
    turn: 2,
    weather: 1,
  },
  ...overrides,
});

function makeInteraction(number: number | null = null): ChatInputCommandInteraction {
  return {
    options: { getInteger: vi.fn().mockReturnValue(number) },
    reply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    deferred: false,
    user: { id: 'user-123' },
    channel: null,
  } as unknown as ChatInputCommandInteraction;
}

describe('buildEmbed', () => {
  it('uses name_en when available', () => {
    const embed = buildEmbed(mockCM());
    expect(embed.toJSON().title).toContain('Taurus Cup');
  });

  it('falls back to name when name_en is absent', () => {
    const embed = buildEmbed(mockCM({ name_en: undefined }));
    expect(embed.toJSON().title).toContain('タウラス杯');
  });

  it('includes CM id in title', () => {
    const embed = buildEmbed(mockCM({ id: 7 }));
    expect(embed.toJSON().title).toContain('CM 7');
  });

  it('displays distance with m suffix', () => {
    const fields = buildEmbed(mockCM()).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Distance')?.value).toBe('2400m');
  });

  it('maps ground 1 to Turf', () => {
    const fields =
      buildEmbed(mockCM({ race: { ...mockCM().race, ground: 1 } })).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Ground')?.value).toBe('Turf');
  });

  it('maps ground 2 to Dirt', () => {
    const fields =
      buildEmbed(mockCM({ race: { ...mockCM().race, ground: 2 } })).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Ground')?.value).toBe('Dirt');
  });

  it('maps season correctly', () => {
    const fields =
      buildEmbed(mockCM({ race: { ...mockCM().race, season: 2 } })).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Season')?.value).toBe('Summer');
  });

  it('maps weather correctly', () => {
    const fields =
      buildEmbed(mockCM({ race: { ...mockCM().race, weather: 3 } })).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Weather')?.value).toBe('Rainy');
  });

  it('maps condition correctly', () => {
    const fields =
      buildEmbed(mockCM({ race: { ...mockCM().race, condition: 4 } })).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Condition')?.value).toBe('Heavy');
  });

  it('maps turn 1 to Right-handed', () => {
    const fields =
      buildEmbed(mockCM({ race: { ...mockCM().race, turn: 1 } })).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Direction')?.value).toBe('Right-handed');
  });

  it('maps turn 2 to Left-handed', () => {
    const fields =
      buildEmbed(mockCM({ race: { ...mockCM().race, turn: 2 } })).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Direction')?.value).toBe('Left-handed');
  });

  it('falls back to raw number for unknown ground', () => {
    const fields =
      buildEmbed(mockCM({ race: { ...mockCM().race, ground: 99 } })).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Ground')?.value).toBe('99');
  });

  it('falls back to raw number for unknown season', () => {
    const fields =
      buildEmbed(mockCM({ race: { ...mockCM().race, season: 99 } })).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Season')?.value).toBe('99');
  });

  it('falls back to raw number for unknown direction', () => {
    const fields =
      buildEmbed(mockCM({ race: { ...mockCM().race, turn: 99 } })).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Direction')?.value).toBe('99');
  });

  it('falls back to raw number for unknown weather', () => {
    const fields =
      buildEmbed(mockCM({ race: { ...mockCM().race, weather: 99 } })).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Weather')?.value).toBe('99');
  });

  it('falls back to raw number for unknown condition', () => {
    const fields =
      buildEmbed(mockCM({ race: { ...mockCM().race, condition: 99 } })).toJSON().fields ?? [];
    expect(fields.find((f) => f.name === 'Condition')?.value).toBe('99');
  });
});

describe('buildRow', () => {
  it('disables prev on first page', () => {
    const components = buildRow(0, 45).toJSON().components;
    expect(components[0].disabled).toBe(true);
    expect(components[1].disabled).toBe(false);
  });

  it('disables next on last page', () => {
    const components = buildRow(44, 45).toJSON().components;
    expect(components[0].disabled).toBe(false);
    expect(components[1].disabled).toBe(true);
  });

  it('enables both on a middle page', () => {
    const components = buildRow(10, 45).toJSON().components;
    expect(components[0].disabled).toBe(false);
    expect(components[1].disabled).toBe(false);
  });
});

describe('execute', () => {
  it('starts at CM 1 when no number provided', async () => {
    const interaction = makeInteraction(null);
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) }),
    );
  });

  it('starts at the correct CM when number is provided', async () => {
    const interaction = makeInteraction(13);
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) }),
    );
  });

  it('replies ephemerally when CM number not found', async () => {
    const interaction = makeInteraction(999);
    await execute(interaction);
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('No Champions Meeting found') }),
    );
  });

  describe('collector', () => {
    function makeCollectorInteraction(number: number | null = null) {
      const handlers: Record<string, (arg: unknown) => Promise<void>> = {};
      const mockCollector = {
        on: vi.fn((event: string, handler: (arg: unknown) => Promise<void>) => {
          handlers[event] = handler;
        }),
        stop: vi.fn(),
      };
      const interaction = makeInteraction(number);
      (interaction as unknown as Record<string, unknown>).channel = {
        createMessageComponentCollector: vi.fn().mockReturnValue(mockCollector),
      };
      return { interaction, handlers };
    }

    it('navigates to next page on next button', async () => {
      const { interaction, handlers } = makeCollectorInteraction();
      await execute(interaction);

      const buttonInteraction = {
        customId: 'cm_next',
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
      await execute(interaction);

      const buttonInteraction = {
        customId: 'cm_prev',
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
      await execute(interaction);

      await handlers['end'](undefined);
      expect(interaction.editReply).toHaveBeenCalledWith({ components: [] });
    });

    it('filters out interactions from other users', async () => {
      const { interaction } = makeCollectorInteraction();
      await execute(interaction);

      const channelMock = interaction.channel as unknown as Record<
        string,
        ReturnType<typeof vi.fn>
      >;
      const { filter } = channelMock.createMessageComponentCollector.mock.calls[0][0] as {
        filter: (i: unknown) => boolean;
      };

      expect(filter({ customId: 'cm_next', user: { id: 'other-user' } })).toBe(false);
    });

    it('filters out interactions with wrong customId', async () => {
      const { interaction } = makeCollectorInteraction();
      await execute(interaction);

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
