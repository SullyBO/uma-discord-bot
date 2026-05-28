/* v8 ignore file */
import { umaCache, skillCache } from '../../cache';
import { TRACK_NAMES } from '../../constants/racetracks';
import type { SkillCondition } from '../../types';
import { normalizeOperator, fmtOp, fmtPositionOp, ordinalSuffix, fieldPos } from './operators';
import {
  PHASE_NAMES,
  RUNNING_STYLE_NAMES,
  DISTANCE_TYPE_NAMES,
  GROUND_CONDITION_NAMES,
  WEATHER_NAMES,
  SEASON_NAMES,
  GRADE_NAMES,
  TIME_NAMES,
  MOTIVATION_NAMES,
  LASTSPURT_NAMES,
} from '../../constants/skill-conditions';

function umaName(id: string): string {
  const uma = umaCache.get(Number(id));
  return uma?.name ?? `unknown character (id: ${id})`;
}

function skillName(id: string): string {
  const skill = skillCache.get(Number(id));
  return skill?.name ?? `unknown skill (id: ${id})`;
}

export function translateCondition(cond: SkillCondition): string {
  const cond_key = cond.cond_key;
  const operator = normalizeOperator(cond.operator);
  const cond_val = cond.cond_val;

  switch (cond_key) {
    case 'always':
      return 'always activates';

    // ── Race phase / progress ────────────────────────────────────────────────

    case 'phase': {
      const names = cond_val.split('@').map((v) => PHASE_NAMES[v] ?? v);
      if (operator === '==') return `in the ${names.join(' or ')}`;
      if (operator === '>=') return `in the ${PHASE_NAMES[cond_val] ?? cond_val} or later`;
      if (operator === '<=') return `in the ${PHASE_NAMES[cond_val] ?? cond_val} or earlier`;
      return `phase ${operator} ${cond_val}`;
    }

    case 'phase_random': {
      const phase = PHASE_NAMES[cond_val] ?? cond_val;
      return `at a random point during the ${phase}`;
    }

    case 'phase_laterhalf_random': {
      const phase = PHASE_NAMES[cond_val] ?? cond_val;
      return `at a random point in the second half of the ${phase}`;
    }

    case 'phase_firsthalf_random': {
      const phase = PHASE_NAMES[cond_val] ?? cond_val;
      return `at a random point in the first half of the ${phase}`;
    }

    case 'phase_firstquarter_random': {
      const phase = PHASE_NAMES[cond_val] ?? cond_val;
      return `at a random point in the first quarter of the ${phase}`;
    }

    case 'phase_corner_random': {
      const phase = PHASE_NAMES[cond_val] ?? cond_val;
      return `at a random corner during the ${phase}`;
    }

    case 'phase_straight_random': {
      const phase = PHASE_NAMES[cond_val] ?? cond_val;
      return `at a random straight during the ${phase}`;
    }

    case 'phase_first_half_straight_random': {
      const phase = PHASE_NAMES[cond_val] ?? cond_val;
      return `at a random straight in the first half of the ${phase}`;
    }

    case 'phase_latter_half_straight_random': {
      const phase = PHASE_NAMES[cond_val] ?? cond_val;
      return `at a random straight in the second half of the ${phase}`;
    }

    case 'phase_firsthalf': {
      const phase = PHASE_NAMES[cond_val] ?? cond_val;
      return `in the first half of the ${phase}`;
    }

    case 'phase_laterhalf': {
      const phase = PHASE_NAMES[cond_val] ?? cond_val;
      return `in the second half of the ${phase}`;
    }

    case 'phase_firstquarter': {
      const phase = PHASE_NAMES[cond_val] ?? cond_val;
      return `in the first quarter of the ${phase}`;
    }

    case 'distance_rate':
      return `race ${fmtOp(operator, `${cond_val}%`)} complete`;

    case 'distance_rate_after_random':
      return `at a random point after ${cond_val}% of the race`;

    case 'remain_distance':
      return `${fmtOp(operator, cond_val)} meters remaining`;

    case 'remain_distance_viewer_id':
      return `any player character at ${fmtOp(operator, cond_val)} meters remaining`;

    case 'accumulatetime':
      return `race ongoing for ${fmtOp(operator, cond_val)} seconds`;

    case 'furlong':
      return `in furlong ${cond_val}`;

    // ── Position / order ─────────────────────────────────────────────────────

    case 'order':
      return `in ${fmtPositionOp(operator, `${cond_val}${ordinalSuffix(cond_val)} place`)}`;

    case 'order_rate': {
      const pct = Number(cond_val);
      const cmPos = fieldPos(pct, 9);
      const lohPos = fieldPos(pct, 12);
      switch (operator) {
        case '<=':
          return `in the top ${cond_val}% of the field (top ${cmPos} in CM, top ${lohPos} in LOH)`;
        case '>=':
          return `in the bottom ${100 - pct}% of the field (bottom ${9 - cmPos} in CM, bottom ${12 - lohPos} in LOH)`;
        case '==':
          return `exactly at the top ${cond_val}% mark (${cmPos}${ordinalSuffix(String(cmPos))} in CM, ${lohPos}${ordinalSuffix(String(lohPos))} in LOH)`;
        default:
          return `position in the field ${operator} top ${cond_val}%`;
      }
    }

    case 'order_rate_in20_continue': {
      const cm = fieldPos(20, 9);
      const loh = fieldPos(20, 12);
      return `been in the top 20% for the entire race (top ${cm} in CM, top ${loh} in LOH)`;
    }

    case 'order_rate_in40_continue': {
      const cm = fieldPos(40, 9);
      const loh = fieldPos(40, 12);
      return `been in the top 40% for the entire race (top ${cm} in CM, top ${loh} in LOH)`;
    }

    case 'order_rate_in50_continue': {
      const cm = fieldPos(50, 9);
      const loh = fieldPos(50, 12);
      return `been in the top 50% for the entire race (top ${cm} in CM, top ${loh} in LOH)`;
    }

    case 'order_rate_in80_continue': {
      const cm = fieldPos(80, 9);
      const loh = fieldPos(80, 12);
      return `been in the top 80% for the entire race (top ${cm} in CM, top ${loh} in LOH)`;
    }

    case 'order_rate_out20_continue': {
      const cm = fieldPos(20, 9);
      const loh = fieldPos(20, 12);
      return `been outside the top 20% for the entire race (${cm + 1}th or worse in CM, ${loh + 1}th or worse in LOH)`;
    }

    case 'order_rate_out40_continue': {
      const cm = fieldPos(40, 9);
      const loh = fieldPos(40, 12);
      return `been outside the top 40% for the entire race (${cm + 1}th or worse in CM, ${loh + 1}th or worse in LOH)`;
    }

    case 'order_rate_out50_continue': {
      const cm = fieldPos(50, 9);
      const loh = fieldPos(50, 12);
      return `been outside the top 50% for the entire race (${cm + 1}th or worse in CM, ${loh + 1}th or worse in LOH)`;
    }

    case 'order_rate_out70_continue': {
      const cm = fieldPos(70, 9);
      const loh = fieldPos(70, 12);
      return `been outside the top 70% for the entire race (${cm + 1}th or worse in CM, ${loh + 1}th or worse in LOH)`;
    }

    case 'distance_diff_rate':
      return `within ${cond_val}% of the field spread behind 1st`;

    case 'distance_diff_top':
      return `gap to 1st is ${fmtOp(operator, cond_val)} meters`;

    case 'distance_diff_top_float': {
      const meters = (Number(cond_val) / 10).toFixed(1);
      return `gap to 1st is ${fmtOp(operator, meters)} meters`;
    }

    // ── Corners / straights ──────────────────────────────────────────────────

    case 'corner': {
      if (operator === '!=' && cond_val === '0') return `on any corner`;
      if (operator === '==' && cond_val === '0') return `not on a corner`;
      const ordinal = ordinalSuffix(cond_val);
      return `on the ${cond_val}${ordinal} corner`;
    }

    case 'corner_random': {
      const ordinal = ordinalSuffix(cond_val);
      return `at a random point on the ${cond_val}${ordinal} corner`;
    }

    case 'all_corner_random':
      return `at a random point on a random corner`;

    case 'is_finalcorner':
      return cond_val === '1' ? `on or past the final corner` : `not on the final corner`;

    case 'is_finalcorner_laterhalf':
      return cond_val === '1'
        ? `in the second half of the final corner`
        : `not in the second half of the final corner`;

    case 'is_finalcorner_random':
      return `at a random point on the final corner`;

    case 'corner_count':
      return `track has ${fmtOp(operator, cond_val)} corners`;

    case 'straight_random':
      return `at a random point on any straight`;

    case 'straight_front_type':
      return cond_val === '1'
        ? `on the straight in front of the audience`
        : `on the straight opposite the audience`;

    case 'is_last_straight':
      return cond_val === '1' ? `on the final straight` : `not on the final straight`;

    case 'is_last_straight_onetime':
      return `just entered the final straight`;

    case 'last_straight_random':
      return `at a random point on the final straight`;

    // ── Stamina / last spurt ─────────────────────────────────────────────────

    case 'hp_per':
      return `stamina at ${fmtOp(operator, `${cond_val}%`)}`;

    case 'is_hp_empty_onetime':
      return cond_val === '1' ? `stamina depleted at some point` : `stamina never depleted`;

    case 'is_lastspurt':
      return cond_val === '1' ? `in last spurt mode` : `not in last spurt mode`;

    case 'lastspurt': {
      const desc = LASTSPURT_NAMES[cond_val];
      return desc ? `${desc}` : `lastspurt ${operator} ${cond_val}`;
    }

    // ── Proximity / blocking ─────────────────────────────────────────────────

    case 'bashin_diff_behind':
      return `closest uma behind at ${fmtOp(operator, cond_val)} length(s) behind`;

    case 'bashin_diff_infront':
      return `closest uma ahead at ${fmtOp(operator, cond_val)} length(s) ahead`;

    case 'near_count':
      return `${fmtOp(operator, cond_val)} other umas nearby`;

    case 'near_infront_count':
      return `${fmtOp(operator, cond_val)} umas right ahead`;

    case 'visiblehorse':
      return `${fmtOp(operator, cond_val)} umas in field of vision`;

    case 'behind_near_lane_time':
      return `uma right behind for ${fmtOp(operator, cond_val)} seconds`;

    case 'behind_near_lane_time_set1':
      return `uma behind for ${fmtOp(operator, cond_val)} seconds`;

    case 'infront_near_lane_time':
      return `uma right ahead for ${fmtOp(operator, cond_val)} seconds`;

    case 'blocked_front':
      return cond_val === '1' ? `blocked from the front` : `not blocked from the front`;

    case 'blocked_front_continuetime':
      return `blocked from the front for ${fmtOp(operator, cond_val)} seconds`;

    case 'blocked_side_continuetime':
      return `blocked from the side for ${fmtOp(operator, cond_val)} seconds`;

    case 'blocked_all_continuetime':
      return `blocked from front and side for ${fmtOp(operator, cond_val)} seconds`;

    case 'is_surrounded':
      return cond_val === '1' ? `surrounded by other umas` : `not surrounded by other umas`;

    // ── Overtaking ───────────────────────────────────────────────────────────

    case 'change_order_onetime':
      return Number(cond_val) < 0 ? `on overtaking another uma` : `on getting overtaken`;

    case 'change_order_up_end_after':
      return `overtaken ${fmtOp(operator, cond_val)} umas since the Late-Race`;

    case 'change_order_up_finalcorner_after':
      return `overtaken ${fmtOp(operator, cond_val)} umas since the final corner`;

    case 'change_order_up_middle':
      return `overtaken ${fmtOp(operator, cond_val)} umas during the Mid-Race`;

    case 'is_overtake':
      return cond_val === '1' ? `have an overtake target` : `no overtake targets`;

    case 'overtake_target_no_order_up_time':
      return `had an overtake target for ${fmtOp(operator, cond_val)} seconds`;

    case 'overtake_target_time':
      return `been an overtake target for ${fmtOp(operator, cond_val)} seconds`;

    case 'compete_fight_count':
      return `been in ${fmtOp(operator, cond_val)} showdown(s) on the final straight`;

    // ── Running style ────────────────────────────────────────────────────────

    case 'running_style': {
      const style = RUNNING_STYLE_NAMES[cond_val] ?? `style ${cond_val}`;
      return `running as ${style}`;
    }

    case 'running_style_count_same':
      return `${fmtOp(operator, cond_val)} umas sharing running style (including self)`;

    case 'running_style_count_same_rate':
      return `${fmtOp(operator, `${cond_val}%`)} of the field shares running style`;

    case 'running_style_count_nige_otherself':
      return `${fmtOp(operator, cond_val)} other Front Runners in the race`;

    case 'running_style_count_senko_otherself':
      return `${fmtOp(operator, cond_val)} other Pace Chasers in the race`;

    case 'running_style_count_sashi_otherself':
      return `${fmtOp(operator, cond_val)} other Late Surgers in the race`;

    case 'running_style_count_oikomi_otherself':
      return `${fmtOp(operator, cond_val)} other End Closers in the race`;

    case 'running_style_equal_popularity_one':
      return cond_val === '1'
        ? `sharing a running style with the most popular uma`
        : `not sharing a running style with the most popular uma`;

    // ── Rushing (kakari) ─────────────────────────────────────────────────────

    case 'is_temptation':
      return cond_val === '1' ? `rushing` : `not rushing`;

    case 'temptation_count':
      return `rushed ${fmtOp(operator, cond_val)} times this race`;

    case 'temptation_count_behind':
      return `${fmtOp(operator, cond_val)} umas behind rushing`;

    case 'temptation_count_infront':
      return `${fmtOp(operator, cond_val)} umas ahead rushing`;

    case 'temptation_opponent_count_behind':
      return `${fmtOp(operator, cond_val)} enemies behind rushing`;

    case 'temptation_opponent_count_infront':
      return `${fmtOp(operator, cond_val)} enemies ahead rushing`;

    case 'running_style_temptation_count_nige':
      return `${fmtOp(operator, cond_val)} rushing Front Runners in the race`;

    case 'running_style_temptation_count_senko':
      return `${fmtOp(operator, cond_val)} rushing Pace Chasers in the race`;

    case 'running_style_temptation_count_sashi':
      return `${fmtOp(operator, cond_val)} rushing Late Surgers in the race`;

    case 'running_style_temptation_count_oikomi':
      return `${fmtOp(operator, cond_val)} rushing End Closers in the race`;

    case 'running_style_temptation_opponent_count_nige':
      return `${fmtOp(operator, cond_val)} rushing enemy Front Runners in the race`;

    case 'running_style_temptation_opponent_count_senko':
      return `${fmtOp(operator, cond_val)} rushing enemy Pace Chasers in the race`;

    case 'running_style_temptation_opponent_count_sashi':
      return `${fmtOp(operator, cond_val)} rushing enemy Late Surgers in the race`;

    case 'running_style_temptation_opponent_count_oikomi':
      return `${fmtOp(operator, cond_val)} rushing enemy End Closers in the race`;

    // ── Skill activation ─────────────────────────────────────────────────────

    case 'activate_count_all':
      return `activated ${fmtOp(operator, cond_val)} skills this race`;

    case 'activate_count_start':
      return `activated ${fmtOp(operator, cond_val)} skills during the Early-Race`;

    case 'activate_count_middle':
      return `activated ${fmtOp(operator, cond_val)} skills during the Mid-Race`;

    case 'activate_count_end_after':
      return `activated ${fmtOp(operator, cond_val)} skills since the Late-Race`;

    case 'activate_count_heal':
      return `activated ${fmtOp(operator, cond_val)} recovery skills this race`;

    case 'activate_count_later_half':
      return `activated ${fmtOp(operator, cond_val)} skills in the second half of the race`;

    case 'activate_count_all_team':
      return `team cumulatively activated ${fmtOp(operator, cond_val)} skills`;

    case 'is_activate_any_skill':
      return cond_val === '1'
        ? `just activated another skill`
        : `haven't just activated another skill`;

    case 'is_activate_heal_skill':
      return cond_val === '1'
        ? `just activated a recovery skill`
        : `haven't just activated a recovery skill`;

    case 'is_activate_other_skill_detail':
      return `an earlier trigger of this skill fired`;

    case 'is_used_skill_id':
      return `activated ${skillName(cond_val)} this race`;

    case 'is_exist_skill_id':
      return `${skillName(cond_val)} present in the race`;

    case 'same_skill_horse_count':
      return `${fmtOp(operator, cond_val)} uma(s) have this skill (including self)`;

    case 'is_other_character_activate_advantage_skill':
      return `another character activated a skill of type ${cond_val}`;

    // ── Track / race conditions ──────────────────────────────────────────────

    case 'track_id': {
      const name = TRACK_NAMES[Number(cond_val)] ?? `track ${cond_val}`;
      return `racing at ${name}`;
    }

    case 'ground_type':
      return cond_val === '1' ? `turf track` : `dirt track`;

    case 'ground_condition': {
      const condition = GROUND_CONDITION_NAMES[cond_val] ?? cond_val;
      return `track condition: ${condition}`;
    }

    case 'distance_type': {
      const type = DISTANCE_TYPE_NAMES[cond_val] ?? cond_val;
      return `${type} distance race`;
    }

    case 'course_distance':
      return `race is ${fmtOp(operator, cond_val)} meters`;

    case 'is_basis_distance':
      return cond_val === '1' ? `core distance (divisible by 400)` : `non-core distance`;

    case 'grade': {
      const grade = GRADE_NAMES[cond_val] ?? cond_val;
      return `grade ${grade} race`;
    }

    case 'weather': {
      const weather = WEATHER_NAMES[cond_val] ?? cond_val;
      return `${weather} weather`;
    }

    case 'season': {
      const seasons = cond_val.split('@').map((v) => SEASON_NAMES[v] ?? v);
      return `during ${seasons.join(' or ')}`;
    }

    case 'time': {
      const time = TIME_NAMES[cond_val] ?? cond_val;
      return `race during ${time}`;
    }

    case 'rotation':
      return cond_val === '1' ? `clockwise track` : `counterclockwise track`;

    case 'slope':
      if (cond_val === '0') return `on flat ground`;
      if (cond_val === '1') return `running uphill`;
      if (cond_val === '2') return `running downhill`;
      return `slope ${operator} ${cond_val}`;

    case 'up_slope_random':
      return `at a random point on any uphill`;

    case 'down_slope_random':
      return `at a random point on any downhill`;

    case 'up_slope_random_later_half':
      return `at a random point on any uphill in the second half of the race`;

    case 'run_at_full_speed_random':
      return `at a random point during full-speed spurt`;

    case 'is_tight_track':
      return cond_val === '1' ? `track with tight corners` : `track without tight corners`;

    case 'is_dirtgrade':
      return cond_val === '1' ? `exchange race (local track)` : `not an exchange race`;

    case 'is_abroad':
      return cond_val === '1' ? `race abroad` : `race in Japan`;

    // ── Lane ────────────────────────────────────────────────────────────────

    case 'lane_type': {
      const val = Number(cond_val);
      let lane: string;
      if (val <= 0.2) lane = 'inner (next to the fence)';
      else if (val <= 0.4) lane = 'middle-inner';
      else if (val <= 0.6) lane = 'middle-outer';
      else lane = 'outer';
      return `running in the ${lane} lane`;
    }

    case 'is_move_lane':
      return cond_val === '1'
        ? `just moved closer to the inner fence`
        : `just moved further from the inner fence`;

    case 'is_behind_in':
      return cond_val === '1'
        ? `uma behind is closer to the inner fence`
        : `uma behind is not closer to the inner fence`;

    // ── Race entry ───────────────────────────────────────────────────────────

    case 'post_number':
      return `started in gate block ${fmtOp(operator, cond_val)}`;

    case 'is_badstart':
      return cond_val === '0' ? `didn't late start` : `late start`;

    case 'popularity':
      return `${fmtPositionOp(operator, `${cond_val}${ordinalSuffix(cond_val)}`)} most popular in the race`;

    case 'fan_count':
      return `${fmtOp(operator, cond_val)} fans`;

    case 'motivation': {
      const mood = MOTIVATION_NAMES[cond_val] ?? cond_val;
      if (operator === '==') return `mood: ${mood}`;
      if (operator === '>=') return `mood ${mood} or better`;
      if (operator === '<=') return `mood ${mood} or worse`;
      return `mood ${operator} ${mood}`;
    }

    // ── Stats ────────────────────────────────────────────────────────────────

    case 'base_speed':
      return `Speed stat ${fmtOp(operator, cond_val)}`;

    case 'base_stamina':
      return `Stamina stat ${fmtOp(operator, cond_val)}`;

    case 'base_power':
      return `Power stat ${fmtOp(operator, cond_val)}`;

    case 'base_guts':
      return `Guts stat ${fmtOp(operator, cond_val)}`;

    case 'base_wiz':
      return `Wisdom stat ${fmtOp(operator, cond_val)}`;

    // ── Characters ───────────────────────────────────────────────────────────

    case 'is_exist_chara_id':
      return `${umaName(cond_val)} is in the race`;

    // ── Misc ─────────────────────────────────────────────────────────────────

    case 'random_lot':
      return `${cond_val}% chance`;

    default:
      return `${cond_key} ${operator} ${cond_val}`;
  }
}
