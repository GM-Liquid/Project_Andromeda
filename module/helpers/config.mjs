export const PROJECT_ANDROMEDA = {};

PROJECT_ANDROMEDA.skills = {
  moshch: 'MY_RPG.Skill.Moshch',
  lovkost: 'MY_RPG.Skill.Lovkost',
  sokrytie: 'MY_RPG.Skill.Sokrytie',
  strelba: 'MY_RPG.Skill.Strelba',
  blizhniy_boy: 'MY_RPG.Skill.Blizhniy_boy',
  nablyudatelnost: 'MY_RPG.Skill.Nablyudatelnost',
  analiz: 'MY_RPG.Skill.Analiz',
  khakerstvo: 'MY_RPG.Skill.Khakerstvo',
  inzheneriya: 'MY_RPG.Skill.Inzheneriya',
  dominirovanie: 'MY_RPG.Skill.Dominirovanie',
  rezonans: 'MY_RPG.Skill.Rezonans',
  mistika: 'MY_RPG.Skill.Mistika',
  obayanie: 'MY_RPG.Skill.Obayanie'
};

PROJECT_ANDROMEDA.skillCategories = {
  body: {
    label: 'MY_RPG.SkillCategory.Body',
    defenseLabel: 'MY_RPG.Defenses.FortitudeLabel',
    defenseKey: 'fortitude',
    skills: ['moshch', 'lovkost', 'sokrytie', 'strelba', 'blizhniy_boy']
  },
  mind: {
    label: 'MY_RPG.SkillCategory.Mind',
    defenseLabel: 'MY_RPG.Defenses.ControlLabel',
    defenseKey: 'control',
    skills: ['nablyudatelnost', 'analiz', 'khakerstvo', 'inzheneriya']
  },
  spirit: {
    label: 'MY_RPG.SkillCategory.Spirit',
    defenseLabel: 'MY_RPG.Defenses.WillLabel',
    defenseKey: 'will',
    skills: ['dominirovanie', 'rezonans', 'mistika', 'obayanie']
  }
};

PROJECT_ANDROMEDA.skillAbbreviations = {};
