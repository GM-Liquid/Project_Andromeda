import {
  formatDamageProfile,
  getDamageForOutcome,
  hasDamageProfileValue
} from './damage-profile.mjs';
import { getSkillCheckOutcomeKey, SKILL_CHECK_FORMULA } from './skill-check.mjs';

function escapeHTML(value) {
  const text = String(value ?? '');
  if (globalThis.foundry?.utils?.escapeHTML) {
    return foundry.utils.escapeHTML(text);
  }
  if (globalThis.TextEditor?.encodeHTML) {
    return TextEditor.encodeHTML(text);
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function localize(key) {
  return globalThis.game?.i18n?.localize?.(key) ?? key;
}

function format(key, data = {}) {
  return globalThis.game?.i18n?.format?.(key, data) ?? key;
}

function formatSignedNumber(value) {
  const number = Number(value) || 0;
  if (number > 0) return `+${number}`;
  return `${number}`;
}

function buildDetailRow(label, value) {
  return `<div class="myrpg-roll-card__detail-row"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`;
}

function normalizeParts(parts = []) {
  return (parts ?? []).filter(
    (part) => part && part.label && part.value !== undefined && part.value !== null
  );
}

export function buildSkillCheckRollFlavor({
  label,
  parts = [],
  skillRank,
  outcomeKey,
  total = null,
  damageProfile = null,
  note = ''
} = {}) {
  const resolvedOutcomeKey = outcomeKey || getSkillCheckOutcomeKey(total);
  const safeOutcomeKey = escapeHTML(String(resolvedOutcomeKey).toLowerCase());
  const safeLabel = escapeHTML(label ?? '');
  const outcomeLabel = escapeHTML(localize(`MY_RPG.SkillCheck.Outcomes.${resolvedOutcomeKey}`));
  const outcomeTitle = escapeHTML(localize('MY_RPG.SkillCheck.OutcomeLabel'));
  const damageTitle = escapeHTML(localize('MY_RPG.SkillCheck.OutcomeDamageLabel'));
  const detailsTitle = escapeHTML(localize('MY_RPG.SkillCheck.RollDetails'));
  const noteTitle = escapeHTML(localize('MY_RPG.SkillCheck.ActivatedDescription'));
  const rankLabel = format('MY_RPG.SkillCheck.SkillRank', { rank: skillRank });
  const rollParts = normalizeParts(parts);
  const details = [
    buildDetailRow(localize('MY_RPG.SkillCheck.RollFormula'), `${SKILL_CHECK_FORMULA} + @mod`),
    buildDetailRow(localize('MY_RPG.SkillCheck.RollTotal'), total ?? '-'),
    buildDetailRow(localize('MY_RPG.SkillCheck.SkillRankLabel'), rankLabel)
  ];

  for (const part of rollParts) {
    details.push(buildDetailRow(part.label, formatSignedNumber(part.value)));
  }

  const showDamage = damageProfile !== null && hasDamageProfileValue(damageProfile);
  const normalizedDamageProfile = showDamage ? formatDamageProfile(damageProfile) : '';
  const outcomeDamage = showDamage ? getDamageForOutcome(damageProfile, resolvedOutcomeKey) : 0;
  if (showDamage) {
    details.push(
      buildDetailRow(localize('MY_RPG.SkillCheck.DamageProfile'), normalizedDamageProfile)
    );
  }

  const damageMetric = showDamage
    ? `<div class="myrpg-roll-card__metric myrpg-roll-card__metric--damage"><span>${damageTitle}</span><strong>${escapeHTML(outcomeDamage)}</strong></div>`
    : '';
  const noteHtml = note
    ? `<section class="myrpg-roll-card__note-section"><div class="myrpg-roll-card__note-title">${noteTitle}</div><div class="myrpg-roll-card__note">${note}</div></section>`
    : '';

  return `<div class="myrpg-roll-card myrpg-roll-card--${safeOutcomeKey}" data-skill-check-card><div class="myrpg-roll-card__heading">${safeLabel}</div><div class="myrpg-roll-card__primary"><div class="myrpg-roll-card__metric myrpg-roll-card__metric--outcome"><span>${outcomeTitle}</span><strong>${outcomeLabel}</strong></div>${damageMetric}</div>${noteHtml}<details class="myrpg-roll-card__details"><summary>${detailsTitle}</summary><div class="myrpg-roll-card__details-body">${details.join('')}</div></details></div>`;
}

export function buildSkillCheckRollFlavorFromData(skillCheck = {}, total = null) {
  if (!skillCheck) return '';
  const outcomeKey = getSkillCheckOutcomeKey(total);
  return buildSkillCheckRollFlavor({
    label: skillCheck.label,
    parts: skillCheck.parts,
    skillRank: skillCheck.rank,
    outcomeKey,
    total,
    damageProfile: skillCheck.damageProfile ?? null,
    note: skillCheck.note ?? ''
  });
}
