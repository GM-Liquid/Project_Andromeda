import {
  formatDamageProfile,
  getDamageForOutcome,
  hasDamageProfileValue
} from './damage-profile.mjs';
import { getSkillCheckOutcomeKey, shiftOutcomeKey, SKILL_CHECK_FORMULA } from './skill-check.mjs';
import { isStepEffectActive, normalizeStepEffects } from './step-effects.mjs';

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

function outcomeLabel(outcomeKey) {
  return localize(`MY_RPG.SkillCheck.Outcomes.${outcomeKey}`);
}

function buildDetailRow(label, value) {
  return `<div class="myrpg-roll-card__detail-row"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`;
}

function normalizeParts(parts = []) {
  return (parts ?? []).filter(
    (part) => part && part.label && part.value !== undefined && part.value !== null
  );
}

function isFiniteRank(skillRank) {
  return Number.isFinite(Number(skillRank));
}

function buildShiftCaption(rolledOutcomeKey, shift) {
  const rolledTitle = escapeHTML(localize('MY_RPG.SkillCheck.RolledOutcome'));
  const rolledLabel = escapeHTML(outcomeLabel(rolledOutcomeKey));
  if (!shift) {
    return `<div class="myrpg-roll-card__caption">${rolledTitle}: ${rolledLabel}</div>`;
  }
  const shiftWord = escapeHTML(localize('MY_RPG.SkillCheck.ShiftWord'));
  const shiftValue = escapeHTML(formatSignedNumber(shift));
  return `<div class="myrpg-roll-card__caption">${rolledTitle}: ${rolledLabel} · ${shiftWord} ${shiftValue}</div>`;
}

function buildEffectsSection(stepEffects, currentOutcomeKey) {
  const effects = normalizeStepEffects(stepEffects);
  if (!effects.length) return '';

  const title = escapeHTML(localize('MY_RPG.SkillCheck.EffectsLabel'));
  const rows = effects
    .map((effect) => {
      const active = isStepEffectActive(effect, currentOutcomeKey);
      const stateClass = active
        ? 'myrpg-roll-card__effect myrpg-roll-card__effect--on'
        : 'myrpg-roll-card__effect';
      const icon = active ? '✓' : '🔒';
      const gate = escapeHTML(outcomeLabel(effect.minOutcome));
      return `<div class="${stateClass}"><span class="myrpg-roll-card__effect-icon">${icon}</span><span class="myrpg-roll-card__effect-text">${escapeHTML(effect.text)}</span><span class="myrpg-roll-card__effect-gate">${gate}</span></div>`;
    })
    .join('');

  return `<section class="myrpg-roll-card__effects"><div class="myrpg-roll-card__effects-title">${title}</div>${rows}</section>`;
}

export function buildSkillCheckRollFlavor({
  label,
  parts = [],
  skillRank,
  outcomeKey,
  shift = 0,
  total = null,
  damageProfile = null,
  stepEffects = [],
  note = ''
} = {}) {
  const rolledOutcomeKey = outcomeKey || getSkillCheckOutcomeKey(total);
  const appliedShift = Number(shift) || 0;
  const currentOutcomeKey = shiftOutcomeKey(rolledOutcomeKey, appliedShift);
  const safeOutcomeKey = escapeHTML(String(currentOutcomeKey).toLowerCase());
  const safeLabel = escapeHTML(label ?? '');

  const showRank = isFiniteRank(skillRank);
  const rankBadge = showRank
    ? `<span class="myrpg-roll-card__rank">${escapeHTML(format('MY_RPG.SkillCheck.SkillRank', { rank: skillRank }))}</span>`
    : '';

  const showDamage = damageProfile !== null && hasDamageProfileValue(damageProfile);
  const normalizedDamageProfile = showDamage ? formatDamageProfile(damageProfile) : '';
  const outcomeDamage = showDamage ? getDamageForOutcome(damageProfile, currentOutcomeKey) : 0;
  const damageBlock = showDamage
    ? `<div class="myrpg-roll-card__damage"><strong>${escapeHTML(outcomeDamage)}</strong><span>${escapeHTML(localize('MY_RPG.SkillCheck.OutcomeDamageLabel'))}</span></div>`
    : '';

  const upTitle = escapeHTML(localize('MY_RPG.SkillCheck.ShiftUp'));
  const downTitle = escapeHTML(localize('MY_RPG.SkillCheck.ShiftDown'));
  const shiftControls = `<div class="myrpg-roll-card__shift-controls"><button type="button" class="myrpg-roll-card__shift" data-skill-shift-step="1" title="${upTitle}" aria-label="${upTitle}">▲</button><button type="button" class="myrpg-roll-card__shift" data-skill-shift-step="-1" title="${downTitle}" aria-label="${downTitle}">▼</button></div>`;

  const dial = `<div class="myrpg-roll-card__dial">${shiftControls}<div class="myrpg-roll-card__dial-main"><div class="myrpg-roll-card__outcome">${escapeHTML(outcomeLabel(currentOutcomeKey))}</div>${buildShiftCaption(rolledOutcomeKey, appliedShift)}</div>${damageBlock}</div>`;

  const noteHtml = note
    ? `<section class="myrpg-roll-card__note-section"><div class="myrpg-roll-card__note-title">${escapeHTML(localize('MY_RPG.SkillCheck.ActivatedDescription'))}</div><div class="myrpg-roll-card__note">${note}</div></section>`
    : '';

  const effectsHtml = buildEffectsSection(stepEffects, currentOutcomeKey);

  const detailsTitle = escapeHTML(localize('MY_RPG.SkillCheck.RollDetails'));
  const rankDetailLabel = format('MY_RPG.SkillCheck.SkillRank', { rank: skillRank });
  const details = [
    buildDetailRow(localize('MY_RPG.SkillCheck.RollFormula'), `${SKILL_CHECK_FORMULA} + @mod`),
    buildDetailRow(localize('MY_RPG.SkillCheck.RollTotal'), total ?? '-')
  ];
  if (showRank) {
    details.push(buildDetailRow(localize('MY_RPG.SkillCheck.SkillRankLabel'), rankDetailLabel));
  }
  for (const part of normalizeParts(parts)) {
    details.push(buildDetailRow(part.label, formatSignedNumber(part.value)));
  }
  if (showDamage) {
    details.push(
      buildDetailRow(localize('MY_RPG.SkillCheck.DamageProfile'), normalizedDamageProfile)
    );
  }

  const detailsHtml = `<details class="myrpg-roll-card__details"><summary>${detailsTitle}</summary><div class="myrpg-roll-card__details-body">${details.join('')}</div></details>`;

  const cardData = `data-skill-check-card data-skill-rolled="${escapeHTML(rolledOutcomeKey)}" data-skill-shift="${escapeHTML(appliedShift)}"`;
  const heading = `<div class="myrpg-roll-card__heading"><span class="myrpg-roll-card__title">${safeLabel}</span>${rankBadge}</div>`;

  return `<div class="myrpg-roll-card myrpg-roll-card--${safeOutcomeKey}" ${cardData}>${heading}${dial}${noteHtml}${effectsHtml}${detailsHtml}</div>`;
}

export function buildSkillCheckRollFlavorFromData(skillCheck = {}, total = null) {
  if (!skillCheck) return '';
  const outcomeKey = getSkillCheckOutcomeKey(total);
  return buildSkillCheckRollFlavor({
    label: skillCheck.label,
    parts: skillCheck.parts,
    skillRank: skillCheck.rank,
    outcomeKey,
    shift: skillCheck.shift ?? 0,
    total,
    damageProfile: skillCheck.damageProfile ?? null,
    stepEffects: skillCheck.stepEffects ?? [],
    note: skillCheck.note ?? ''
  });
}
