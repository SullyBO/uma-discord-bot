import type { SkillCondition } from '../../types';
import { capitalize } from '../formatters';
import { normalizeOperator, ordinalSuffix, fieldPos } from './operators';
import { translateCondition } from './translate';

// Returns a merged range string for keys that support it, or null if the key
// doesn't make sense as a range (letting both conditions render individually).
export function translateRange(cond_key: string, lo: string, hi: string): string | null {
  switch (cond_key) {
    case 'order_rate': {
      // lo = >= value (lower percentile bound), hi = <= value (upper percentile bound)
      // e.g. >= 20 and <= 70 means "placed between the top 20% and 70%"
      const loPct = Number(lo);
      const hiPct = Number(hi);
      if (loPct >= hiPct) return null;
      const cmLo = fieldPos(loPct, 9);
      const cmHi = fieldPos(hiPct, 9);
      const lohLo = fieldPos(loPct, 12);
      const lohHi = fieldPos(hiPct, 12);
      return `placed between the top ${loPct}% and ${hiPct}% of the field \n\u2002(${cmLo}${ordinalSuffix(String(cmLo))}–${cmHi}${ordinalSuffix(String(cmHi))} in CM, ${lohLo}${ordinalSuffix(String(lohLo))}–${lohHi}${ordinalSuffix(String(lohHi))} in LOH)`;
    }
    case 'remain_distance':
      return `between ${lo} and ${hi} meters remaining`;
    case 'remain_distance_viewer_id':
      return `any player character between ${lo} and ${hi} meters remaining`;
    case 'hp_per':
      return `stamina between ${lo}% and ${hi}%`;
    case 'distance_rate':
      return `race between ${lo}% and ${hi}% complete`;
    case 'accumulatetime':
      return `race ongoing for ${lo}–${hi} seconds`;
    case 'distance_diff_top':
      return `gap to 1st between ${lo} and ${hi} meters`;
    case 'distance_diff_top_float': {
      const loM = (Number(lo) / 10).toFixed(1);
      const hiM = (Number(hi) / 10).toFixed(1);
      return `gap to 1st between ${loM} and ${hiM} meters`;
    }
    case 'bashin_diff_behind':
      return `closest uma behind between ${lo} and ${hi} lengths`;
    case 'bashin_diff_infront':
      return `closest uma ahead between ${lo} and ${hi} lengths`;
    case 'near_count':
      return `between ${lo} and ${hi} other umas nearby`;
    case 'near_infront_count':
      return `between ${lo} and ${hi} umas right ahead`;
    case 'visiblehorse':
      return `between ${lo} and ${hi} umas in field of vision`;
    case 'behind_near_lane_time':
      return `uma right behind for ${lo}–${hi} seconds`;
    case 'behind_near_lane_time_set1':
      return `uma behind for ${lo}–${hi} seconds`;
    case 'infront_near_lane_time':
      return `uma right ahead for ${lo}–${hi} seconds`;
    case 'blocked_front_continuetime':
      return `blocked from the front for ${lo}–${hi} seconds`;
    case 'blocked_side_continuetime':
      return `blocked from the side for ${lo}–${hi} seconds`;
    case 'blocked_all_continuetime':
      return `blocked from front and side for ${lo}–${hi} seconds`;
    case 'overtake_target_no_order_up_time':
      return `had an overtake target for ${lo}–${hi} seconds`;
    case 'overtake_target_time':
      return `been an overtake target for ${lo}–${hi} seconds`;
    case 'compete_fight_count':
      return `been in ${lo}–${hi} showdowns on the final straight`;
    case 'temptation_count':
      return `rushed ${lo}–${hi} times this race`;
    case 'activate_count_all':
      return `activated ${lo}–${hi} skills this race`;
    case 'activate_count_start':
      return `activated ${lo}–${hi} skills during the Early-Race`;
    case 'activate_count_middle':
      return `activated ${lo}–${hi} skills during the Mid-Race`;
    case 'activate_count_end_after':
      return `activated ${lo}–${hi} skills since the Late-Race`;
    case 'activate_count_heal':
      return `activated ${lo}–${hi} recovery skills this race`;
    case 'activate_count_later_half':
      return `activated ${lo}–${hi} skills in the second half of the race`;
    case 'activate_count_all_team':
      return `team cumulatively activated ${lo}–${hi} skills`;
    case 'base_speed':
      return `Speed stat between ${lo} and ${hi}`;
    case 'base_stamina':
      return `Stamina stat between ${lo} and ${hi}`;
    case 'base_power':
      return `Power stat between ${lo} and ${hi}`;
    case 'base_guts':
      return `Guts stat between ${lo} and ${hi}`;
    case 'base_wiz':
      return `Wisdom stat between ${lo} and ${hi}`;
    case 'fan_count':
      return `between ${lo} and ${hi} fans`;
    case 'course_distance':
      return `race between ${lo} and ${hi} meters`;
    case 'order':
      return `between ${lo}${ordinalSuffix(lo)} and ${hi}${ordinalSuffix(hi)} place`;
    default:
      return null;
  }
}

// Splits a flat condition list into OR-bounded groups.
// A new group starts at each condition with is_or: true.
export function splitIntoOrGroups(conditions: SkillCondition[]): SkillCondition[][] {
  const groups: SkillCondition[][] = [];
  for (const cond of conditions) {
    if (cond.is_or || groups.length === 0) {
      groups.push([]);
    }
    groups[groups.length - 1].push(cond);
  }
  return groups;
}

// Within a single OR group, finds >= / <= pairs on the same key and collapses
// them into a single range condition. Returns the rendered lines for the group.
export function renderGroup(group: SkillCondition[], isOrGroup: boolean): string[] {
  const normalizedGroup = group.map((c) => ({
    ...c,
    operator: normalizeOperator(c.operator),
  }));

  // ── Multi-key merges ───────────────────────────────────────────────────────
  // Detect combinations of conditions that together imply a single concept.

  const hasFinalCornerOn = normalizedGroup.some(
    (c) => c.cond_key === 'is_finalcorner' && c.operator === '==' && c.cond_val === '1',
  );
  const hasNotOnCorner = normalizedGroup.some(
    (c) => c.cond_key === 'corner' && c.operator === '==' && c.cond_val === '0',
  );
  const finalStraightMerge = hasFinalCornerOn && hasNotOnCorner;

  // Keys suppressed by a multi-key merge (emitted as a single combined line instead)
  const multiKeySuppress = new Set<string>();
  const multiKeyLines: { afterKey: string; text: string }[] = [];

  if (finalStraightMerge) {
    multiKeySuppress.add('is_finalcorner');
    multiKeySuppress.add('corner');
    // Emit in place of whichever of the two appears first
    const firstKey = normalizedGroup.find(
      (c) => c.cond_key === 'is_finalcorner' || c.cond_key === 'corner',
    )!.cond_key;
    multiKeyLines.push({ afterKey: firstKey, text: 'on the final straight' });
  }

  // ── Single-key range merges ────────────────────────────────────────────────

  // Build a map of key -> { gte, lte } for range candidates
  const rangeCandidates = new Map<string, { gte?: SkillCondition; lte?: SkillCondition }>();
  for (const cond of normalizedGroup) {
    if (cond.operator === '>=' || cond.operator === '<=') {
      if (!rangeCandidates.has(cond.cond_key)) {
        rangeCandidates.set(cond.cond_key, {});
      }
      const entry = rangeCandidates.get(cond.cond_key)!;
      if (cond.operator === '>=') entry.gte = cond;
      else entry.lte = cond;
    }
  }

  // Determine which keys successfully form a range
  const mergedKeys = new Map<string, string>();
  for (const [key, { gte, lte }] of rangeCandidates) {
    if (!gte || !lte) continue;
    const rangeStr = translateRange(key, gte.cond_val, lte.cond_val);
    if (rangeStr !== null) {
      mergedKeys.set(key, rangeStr);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const lines: string[] = [];
  const emittedMerges = new Set<string>();
  const emittedMultiKeys = new Set<string>();

  for (const cond of normalizedGroup) {
    // Multi-key merge: suppress both keys, emit combined line at first occurrence
    if (multiKeySuppress.has(cond.cond_key)) {
      const merge = multiKeyLines.find((m) => m.afterKey === cond.cond_key);
      if (merge && !emittedMultiKeys.has(merge.text)) {
        emittedMultiKeys.add(merge.text);
        lines.push(capitalize(merge.text));
      }
      continue;
    }

    // Single-key range merge
    if (mergedKeys.has(cond.cond_key) && (cond.operator === '>=' || cond.operator === '<=')) {
      if (!emittedMerges.has(cond.cond_key)) {
        emittedMerges.add(cond.cond_key);
        lines.push(capitalize(mergedKeys.get(cond.cond_key)!));
      }
      continue;
    }

    lines.push(capitalize(translateCondition(cond)));
  }

  // Prefix: first line of an OR group gets "OR", all lines get bullet
  return lines.map((line, i) => {
    const orPrefix = isOrGroup && i === 0 ? 'OR \n' : '';
    return `${orPrefix}• ${line}`;
  });
}
