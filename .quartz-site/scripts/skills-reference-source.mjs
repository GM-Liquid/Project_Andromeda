const INTRO_HEADING = '### Что означают значения навыков';
const SKILLS_LIST_HEADING = '### Список навыков';

const skillGroupAbilityMap = new Map([
  ['Навыки Тела', 'Тело'],
  ['Навыки Разума', 'Разум'],
  ['Навыки Духа', 'Дух']
]);

function trimBlankLines(lines) {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim() === '') {
    start += 1;
  }

  while (end > start && lines[end - 1].trim() === '') {
    end -= 1;
  }

  return lines.slice(start, end);
}

function parseSkillTitle(line) {
  const match = line.trim().match(/^\*\*(.+?)\*\*$/);
  return match ? match[1].trim() : null;
}

export function transformSkillsReferenceSource(source) {
  const cleaned = source.replace(/^\uFEFF/, '').trim();
  if (!cleaned) {
    throw new Error('Навыки.md is empty.');
  }

  const lines = cleaned.split(/\r?\n/);
  const introIndex = lines.findIndex((line) => line.trim() === INTRO_HEADING);
  if (introIndex === -1) {
    throw new Error(`Missing required heading: ${INTRO_HEADING}`);
  }

  const skillsListIndex = lines.findIndex((line) => line.trim() === SKILLS_LIST_HEADING);
  if (skillsListIndex === -1) {
    throw new Error(`Missing required heading: ${SKILLS_LIST_HEADING}`);
  }

  if (skillsListIndex <= introIndex) {
    throw new Error('Список навыков must appear after the intro section.');
  }

  const summaryLines = trimBlankLines(lines.slice(introIndex + 1, skillsListIndex));
  const output = [':::summary', ...summaryLines, ':::', ''];
  const skillsLines = lines.slice(skillsListIndex + 1);

  let currentGroup = null;
  for (let index = 0; index < skillsLines.length; ) {
    const line = skillsLines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      const groupTitle = trimmed.slice(5).trim();
      const abilityLabel = skillGroupAbilityMap.get(groupTitle);
      if (!abilityLabel) {
        throw new Error(`Unsupported skills group heading: ${groupTitle}`);
      }

      currentGroup = {
        title: groupTitle,
        abilityLabel
      };

      output.push(`## ${groupTitle}`, '');
      index += 1;
      continue;
    }

    if (!currentGroup) {
      throw new Error(`Found content before a supported skills group heading: ${trimmed}`);
    }

    const skillTitle = parseSkillTitle(trimmed);
    if (!skillTitle) {
      throw new Error(`Unsupported content inside skills list: ${trimmed}`);
    }

    index += 1;
    const bodyLines = [];
    while (index < skillsLines.length) {
      const candidate = skillsLines[index];
      const candidateTrimmed = candidate.trim();

      if (candidateTrimmed.startsWith('#### ') || parseSkillTitle(candidateTrimmed)) {
        break;
      }

      bodyLines.push(candidate);
      index += 1;
    }

    const normalizedBody = trimBlankLines(bodyLines);
    if (normalizedBody.length === 0) {
      throw new Error(`Skill "${skillTitle}" is missing body text.`);
    }

    output.push(
      `:::accordion "${skillTitle}" | ${currentGroup.abilityLabel}`,
      ...normalizedBody,
      ':::',
      ''
    );
  }

  return trimBlankLines(output).join('\n');
}
