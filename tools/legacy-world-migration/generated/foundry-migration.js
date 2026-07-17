// Generated one-time migration for Project Andromeda world 312.
// Run once with APPLY=false for validation. To apply intentionally, first run:
// globalThis.PROJECT_ANDROMEDA_APPLY_LEGACY_312 = true
await (async () => {
  const APPLY = globalThis.PROJECT_ANDROMEDA_APPLY_LEGACY_312 === true;
  const MODULE_ID = "project-andromeda";
  const FLAG = "legacyWorld312MigrationVersion";
  const VERSION = 2;
  const plan = {
  "migration": "legacy-world-312-player-characters",
  "version": 2,
  "generatedAt": "2026-07-12T14:12:23.815Z",
  "actors": [
    {
      "actorId": "ak6zclPEsoPm9Kfl",
      "actorName": "Эравель",
      "actorType": "playerCharacter",
      "migrationVersion": 2,
      "archetype": null,
      "decisions": {
        "archetype": "left-empty-for-player-choice",
        "defenses": "reset-to-rank-until-archetype-choice",
        "skillRank": "all-skills-start-at-rank-1",
        "skillValue": "preserve-old-value-clamped-to-0-4",
        "legacyAbilities": "keep-unranked-and-free-until-curated"
      },
      "changes": {
        "heroPoints": {
          "from": 13,
          "to": 3
        },
        "defenses": {
          "from": {
            "physical": 12,
            "azure": 11,
            "mental": 11
          },
          "to": {
            "fortitude": 3,
            "control": 3,
            "will": 3
          }
        },
        "skills": {
          "skills": {
            "moshch": {
              "rank": 1,
              "value": 2
            },
            "lovkost": {
              "rank": 1,
              "value": 4
            },
            "sokrytie": {
              "rank": 1,
              "value": 0
            },
            "strelba": {
              "rank": 1,
              "value": 0
            },
            "blizhniy_boy": {
              "rank": 1,
              "value": 3
            },
            "nablyudatelnost": {
              "rank": 1,
              "value": 0
            },
            "analiz": {
              "rank": 1,
              "value": 0
            },
            "khakerstvo": {
              "rank": 1,
              "value": 0
            },
            "inzheneriya": {
              "rank": 1,
              "value": 3
            },
            "dominirovanie": {
              "rank": 1,
              "value": 3
            },
            "rezonans": {
              "rank": 1,
              "value": 0
            },
            "mistika": {
              "rank": 1,
              "value": 0
            },
            "obayanie": {
              "rank": 1,
              "value": 3
            }
          },
          "mappingsApplied": [
            {
              "from": "programmirovanie",
              "to": "khakerstvo",
              "oldValue": 0,
              "migratedValue": 0,
              "clamped": false
            },
            {
              "from": "bionika",
              "to": "mistika",
              "oldValue": 0,
              "migratedValue": 0,
              "clamped": false
            }
          ],
          "unresolved": []
        },
        "abilities": [
          "Контратака",
          "Боевой транс",
          "Разрыв реальности",
          "Камидзарэ",
          "Чтение",
          "Сжатый воздух",
          "Отражение снарядов",
          "Пассивная способность",
          "Легкая поступь. Пассивная способность",
          "Град ударов"
        ]
      },
      "actorUpdate": {
        "system.currentRank": 3,
        "system.momentOfGlory": 3,
        "system.skills": {
          "moshch": {
            "rank": 1,
            "value": 2
          },
          "lovkost": {
            "rank": 1,
            "value": 4
          },
          "sokrytie": {
            "rank": 1,
            "value": 0
          },
          "strelba": {
            "rank": 1,
            "value": 0
          },
          "blizhniy_boy": {
            "rank": 1,
            "value": 3
          },
          "nablyudatelnost": {
            "rank": 1,
            "value": 0
          },
          "analiz": {
            "rank": 1,
            "value": 0
          },
          "khakerstvo": {
            "rank": 1,
            "value": 0
          },
          "inzheneriya": {
            "rank": 1,
            "value": 3
          },
          "dominirovanie": {
            "rank": 1,
            "value": 3
          },
          "rezonans": {
            "rank": 1,
            "value": 0
          },
          "mistika": {
            "rank": 1,
            "value": 0
          },
          "obayanie": {
            "rank": 1,
            "value": 3
          }
        },
        "system.skills.-=programmirovanie": null,
        "system.skills.-=bionika": null,
        "system.defenses": {
          "fortitude": 3,
          "control": 3,
          "will": 3
        },
        "system.defenses.-=physical": null,
        "system.defenses.-=azure": null,
        "system.defenses.-=mental": null,
        "system.tempfortitude": 0,
        "system.tempcontrol": 0,
        "system.tempwill": 0,
        "system.stress.value": 0,
        "system.stress.marked": [],
        "system.biography": {
          "feature": "",
          "weakness": "",
          "temperament": "",
          "archetype": "",
          "appearance": "",
          "backstory": ""
        },
        "system.-=abilities": null,
        "system.-=tempphys": null,
        "system.-=tempazure": null,
        "system.-=tempmental": null,
        "flags.project-andromeda.legacyWorld312MigrationVersion": 2
      },
      "abilityUpdates": [
        {
          "_id": "0EokSDD3yKMXHUqq",
          "name": "Контратака",
          "update": {
            "_id": "0EokSDD3yKMXHUqq",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "A06qncGHMfim1pBk",
          "name": "Боевой транс",
          "update": {
            "_id": "A06qncGHMfim1pBk",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "DWzdrgCVT3iaxPwu",
          "name": "Разрыв реальности",
          "update": {
            "_id": "DWzdrgCVT3iaxPwu",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "FedwbvxBJ9Zeh7Mu",
          "name": "Камидзарэ",
          "update": {
            "_id": "FedwbvxBJ9Zeh7Mu",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "KRSDrTjq22THaFvY",
          "name": "Чтение",
          "update": {
            "_id": "KRSDrTjq22THaFvY",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "KtLqdytrmNtmmCxg",
          "name": "Сжатый воздух",
          "update": {
            "_id": "KtLqdytrmNtmmCxg",
            "system.skill": "blizhniy_boy",
            "system.requiresRoll": true,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "OkvNfFsfui2yFX1S",
          "name": "Отражение снарядов",
          "update": {
            "_id": "OkvNfFsfui2yFX1S",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "SAAjwywOG5AFpVXY",
          "name": "Пассивная способность",
          "update": {
            "_id": "SAAjwywOG5AFpVXY",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "UPhf0gvun36AlOtL",
          "name": "Легкая поступь. Пассивная способность",
          "update": {
            "_id": "UPhf0gvun36AlOtL",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "suXRsTapIt4nSJ3e",
          "name": "Град ударов",
          "update": {
            "_id": "suXRsTapIt4nSJ3e",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        }
      ]
    },
    {
      "actorId": "cd7YDHUjy6oaBKea",
      "actorName": "Питомец Эравель",
      "actorType": "playerCharacter",
      "migrationVersion": 2,
      "archetype": null,
      "decisions": {
        "archetype": "left-empty-for-player-choice",
        "defenses": "reset-to-rank-until-archetype-choice",
        "skillRank": "all-skills-start-at-rank-1",
        "skillValue": "preserve-old-value-clamped-to-0-4",
        "legacyAbilities": "keep-unranked-and-free-until-curated"
      },
      "changes": {
        "heroPoints": {
          "from": 0,
          "to": 0
        },
        "defenses": {
          "from": {
            "physical": 9,
            "azure": 9,
            "mental": 8
          },
          "to": {
            "fortitude": 2,
            "control": 2,
            "will": 2
          }
        },
        "skills": {
          "skills": {
            "moshch": {
              "rank": 1,
              "value": 2
            },
            "lovkost": {
              "rank": 1,
              "value": 2
            },
            "sokrytie": {
              "rank": 1,
              "value": 0
            },
            "strelba": {
              "rank": 1,
              "value": 0
            },
            "blizhniy_boy": {
              "rank": 1,
              "value": 2
            },
            "nablyudatelnost": {
              "rank": 1,
              "value": 0
            },
            "analiz": {
              "rank": 1,
              "value": 0
            },
            "khakerstvo": {
              "rank": 1,
              "value": 0
            },
            "inzheneriya": {
              "rank": 1,
              "value": 0
            },
            "dominirovanie": {
              "rank": 1,
              "value": 0
            },
            "rezonans": {
              "rank": 1,
              "value": 2
            },
            "mistika": {
              "rank": 1,
              "value": 0
            },
            "obayanie": {
              "rank": 1,
              "value": 0
            }
          },
          "mappingsApplied": [
            {
              "from": "programmirovanie",
              "to": "khakerstvo",
              "oldValue": 0,
              "migratedValue": 0,
              "clamped": false
            },
            {
              "from": "bionika",
              "to": "mistika",
              "oldValue": 0,
              "migratedValue": 0,
              "clamped": false
            }
          ],
          "unresolved": []
        },
        "abilities": []
      },
      "actorUpdate": {
        "system.currentRank": 2,
        "system.momentOfGlory": 0,
        "system.skills": {
          "moshch": {
            "rank": 1,
            "value": 2
          },
          "lovkost": {
            "rank": 1,
            "value": 2
          },
          "sokrytie": {
            "rank": 1,
            "value": 0
          },
          "strelba": {
            "rank": 1,
            "value": 0
          },
          "blizhniy_boy": {
            "rank": 1,
            "value": 2
          },
          "nablyudatelnost": {
            "rank": 1,
            "value": 0
          },
          "analiz": {
            "rank": 1,
            "value": 0
          },
          "khakerstvo": {
            "rank": 1,
            "value": 0
          },
          "inzheneriya": {
            "rank": 1,
            "value": 0
          },
          "dominirovanie": {
            "rank": 1,
            "value": 0
          },
          "rezonans": {
            "rank": 1,
            "value": 2
          },
          "mistika": {
            "rank": 1,
            "value": 0
          },
          "obayanie": {
            "rank": 1,
            "value": 0
          }
        },
        "system.skills.-=programmirovanie": null,
        "system.skills.-=bionika": null,
        "system.defenses": {
          "fortitude": 2,
          "control": 2,
          "will": 2
        },
        "system.defenses.-=physical": null,
        "system.defenses.-=azure": null,
        "system.defenses.-=mental": null,
        "system.tempfortitude": 0,
        "system.tempcontrol": 0,
        "system.tempwill": 0,
        "system.stress.value": 0,
        "system.stress.marked": [],
        "system.biography": {
          "feature": "",
          "weakness": "",
          "temperament": "",
          "archetype": "",
          "appearance": "",
          "backstory": ""
        },
        "system.-=abilities": null,
        "system.-=tempphys": null,
        "system.-=tempazure": null,
        "system.-=tempmental": null,
        "flags.project-andromeda.legacyWorld312MigrationVersion": 2
      },
      "abilityUpdates": []
    },
    {
      "actorId": "hDXTJgw3d3VIjktx",
      "actorName": "Мари",
      "actorType": "playerCharacter",
      "migrationVersion": 2,
      "archetype": null,
      "decisions": {
        "archetype": "left-empty-for-player-choice",
        "defenses": "reset-to-rank-until-archetype-choice",
        "skillRank": "all-skills-start-at-rank-1",
        "skillValue": "preserve-old-value-clamped-to-0-4",
        "legacyAbilities": "keep-unranked-and-free-until-curated"
      },
      "changes": {
        "heroPoints": {
          "from": 7,
          "to": 3
        },
        "defenses": {
          "from": {
            "physical": 12,
            "azure": 11,
            "mental": 10
          },
          "to": {
            "fortitude": 3,
            "control": 3,
            "will": 3
          }
        },
        "skills": {
          "skills": {
            "moshch": {
              "rank": 1,
              "value": 0
            },
            "lovkost": {
              "rank": 1,
              "value": 0
            },
            "sokrytie": {
              "rank": 1,
              "value": 2
            },
            "strelba": {
              "rank": 1,
              "value": 2
            },
            "blizhniy_boy": {
              "rank": 1,
              "value": 0
            },
            "nablyudatelnost": {
              "rank": 1,
              "value": 0
            },
            "analiz": {
              "rank": 1,
              "value": 1
            },
            "khakerstvo": {
              "rank": 1,
              "value": 4
            },
            "inzheneriya": {
              "rank": 1,
              "value": 3
            },
            "dominirovanie": {
              "rank": 1,
              "value": 1
            },
            "rezonans": {
              "rank": 1,
              "value": 0
            },
            "mistika": {
              "rank": 1,
              "value": 0
            },
            "obayanie": {
              "rank": 1,
              "value": 4
            }
          },
          "mappingsApplied": [
            {
              "from": "programmirovanie",
              "to": "khakerstvo",
              "oldValue": 4,
              "migratedValue": 4,
              "clamped": false
            },
            {
              "from": "bionika",
              "to": "mistika",
              "oldValue": 0,
              "migratedValue": 0,
              "clamped": false
            }
          ],
          "unresolved": []
        },
        "abilities": [
          "Боевой купол",
          "Зарядка",
          "Дальнний взлом",
          "Помехи",
          "Взлом",
          "Силовой заслон",
          "Быстрый взлом",
          "Отражающий щит",
          "Обнаружение техники",
          "Программируя реальность"
        ]
      },
      "actorUpdate": {
        "system.currentRank": 3,
        "system.momentOfGlory": 3,
        "system.skills": {
          "moshch": {
            "rank": 1,
            "value": 0
          },
          "lovkost": {
            "rank": 1,
            "value": 0
          },
          "sokrytie": {
            "rank": 1,
            "value": 2
          },
          "strelba": {
            "rank": 1,
            "value": 2
          },
          "blizhniy_boy": {
            "rank": 1,
            "value": 0
          },
          "nablyudatelnost": {
            "rank": 1,
            "value": 0
          },
          "analiz": {
            "rank": 1,
            "value": 1
          },
          "khakerstvo": {
            "rank": 1,
            "value": 4
          },
          "inzheneriya": {
            "rank": 1,
            "value": 3
          },
          "dominirovanie": {
            "rank": 1,
            "value": 1
          },
          "rezonans": {
            "rank": 1,
            "value": 0
          },
          "mistika": {
            "rank": 1,
            "value": 0
          },
          "obayanie": {
            "rank": 1,
            "value": 4
          }
        },
        "system.skills.-=programmirovanie": null,
        "system.skills.-=bionika": null,
        "system.defenses": {
          "fortitude": 3,
          "control": 3,
          "will": 3
        },
        "system.defenses.-=physical": null,
        "system.defenses.-=azure": null,
        "system.defenses.-=mental": null,
        "system.tempfortitude": 0,
        "system.tempcontrol": 0,
        "system.tempwill": 0,
        "system.stress.value": 5,
        "system.stress.marked": [],
        "system.biography": {
          "feature": "",
          "weakness": "",
          "temperament": "",
          "archetype": "",
          "appearance": "",
          "backstory": ""
        },
        "system.-=abilities": null,
        "system.-=tempphys": null,
        "system.-=tempazure": null,
        "system.-=tempmental": null,
        "flags.project-andromeda.legacyWorld312MigrationVersion": 2
      },
      "abilityUpdates": [
        {
          "_id": "44qG2cAUuVih2stK",
          "name": "Боевой купол",
          "update": {
            "_id": "44qG2cAUuVih2stK",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "6TQQouvLBE6LEAcC",
          "name": "Зарядка",
          "update": {
            "_id": "6TQQouvLBE6LEAcC",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "9vEoXJMd5XxuwsH8",
          "name": "Дальнний взлом",
          "update": {
            "_id": "9vEoXJMd5XxuwsH8",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "CI9eUBUOgR7Vt2wE",
          "name": "Помехи",
          "update": {
            "_id": "CI9eUBUOgR7Vt2wE",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "FlSLtPLpcvaEzvGt",
          "name": "Взлом",
          "update": {
            "_id": "FlSLtPLpcvaEzvGt",
            "system.skill": "khakerstvo",
            "system.requiresRoll": true,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "GEwUsSFwvYW0D9qR",
          "name": "Силовой заслон",
          "update": {
            "_id": "GEwUsSFwvYW0D9qR",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "Ym6we5XtqCB6Wn2E",
          "name": "Быстрый взлом",
          "update": {
            "_id": "Ym6we5XtqCB6Wn2E",
            "system.skill": "khakerstvo",
            "system.requiresRoll": true,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "cRTW1uBGHBZAcPuI",
          "name": "Отражающий щит",
          "update": {
            "_id": "cRTW1uBGHBZAcPuI",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "jmaBXH8AGNwEldIj",
          "name": "Обнаружение техники",
          "update": {
            "_id": "jmaBXH8AGNwEldIj",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "lzv9QvFukjYCpFCM",
          "name": "Программируя реальность",
          "update": {
            "_id": "lzv9QvFukjYCpFCM",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        }
      ]
    },
    {
      "actorId": "iXQ1klYcj2TBNatJ",
      "actorName": "Зверь",
      "actorType": "playerCharacter",
      "migrationVersion": 2,
      "archetype": null,
      "decisions": {
        "archetype": "left-empty-for-player-choice",
        "defenses": "reset-to-rank-until-archetype-choice",
        "skillRank": "all-skills-start-at-rank-1",
        "skillValue": "preserve-old-value-clamped-to-0-4",
        "legacyAbilities": "keep-unranked-and-free-until-curated"
      },
      "changes": {
        "heroPoints": {
          "from": 7,
          "to": 3
        },
        "defenses": {
          "from": {
            "physical": 11,
            "azure": 11,
            "mental": 10
          },
          "to": {
            "fortitude": 2,
            "control": 2,
            "will": 2
          }
        },
        "skills": {
          "skills": {
            "moshch": {
              "rank": 1,
              "value": 3
            },
            "lovkost": {
              "rank": 1,
              "value": 3
            },
            "sokrytie": {
              "rank": 1,
              "value": 0
            },
            "strelba": {
              "rank": 1,
              "value": 0
            },
            "blizhniy_boy": {
              "rank": 1,
              "value": 3
            },
            "nablyudatelnost": {
              "rank": 1,
              "value": 0
            },
            "analiz": {
              "rank": 1,
              "value": 0
            },
            "khakerstvo": {
              "rank": 1,
              "value": 0
            },
            "inzheneriya": {
              "rank": 1,
              "value": 0
            },
            "dominirovanie": {
              "rank": 1,
              "value": 0
            },
            "rezonans": {
              "rank": 1,
              "value": 0
            },
            "mistika": {
              "rank": 1,
              "value": 4
            },
            "obayanie": {
              "rank": 1,
              "value": 0
            }
          },
          "mappingsApplied": [
            {
              "from": "programmirovanie",
              "to": "khakerstvo",
              "oldValue": 0,
              "migratedValue": 0,
              "clamped": false
            },
            {
              "from": "bionika",
              "to": "mistika",
              "oldValue": 5,
              "migratedValue": 4,
              "clamped": true
            }
          ],
          "unresolved": []
        },
        "abilities": [
          "Биосенсорика",
          "Умиротворение",
          "Управляемая мутация",
          "Чувство Азур",
          "Разговор с животными/растениями",
          "Удержание",
          "Ускорение регенерации",
          "Базовая способность: Источника",
          "Боевые феромоны",
          "Очищение"
        ]
      },
      "actorUpdate": {
        "system.currentRank": 2,
        "system.momentOfGlory": 3,
        "system.skills": {
          "moshch": {
            "rank": 1,
            "value": 3
          },
          "lovkost": {
            "rank": 1,
            "value": 3
          },
          "sokrytie": {
            "rank": 1,
            "value": 0
          },
          "strelba": {
            "rank": 1,
            "value": 0
          },
          "blizhniy_boy": {
            "rank": 1,
            "value": 3
          },
          "nablyudatelnost": {
            "rank": 1,
            "value": 0
          },
          "analiz": {
            "rank": 1,
            "value": 0
          },
          "khakerstvo": {
            "rank": 1,
            "value": 0
          },
          "inzheneriya": {
            "rank": 1,
            "value": 0
          },
          "dominirovanie": {
            "rank": 1,
            "value": 0
          },
          "rezonans": {
            "rank": 1,
            "value": 0
          },
          "mistika": {
            "rank": 1,
            "value": 4
          },
          "obayanie": {
            "rank": 1,
            "value": 0
          }
        },
        "system.skills.-=programmirovanie": null,
        "system.skills.-=bionika": null,
        "system.defenses": {
          "fortitude": 2,
          "control": 2,
          "will": 2
        },
        "system.defenses.-=physical": null,
        "system.defenses.-=azure": null,
        "system.defenses.-=mental": null,
        "system.tempfortitude": 0,
        "system.tempcontrol": 0,
        "system.tempwill": 0,
        "system.stress.value": 0,
        "system.stress.marked": [],
        "system.biography": {
          "feature": "",
          "weakness": "",
          "temperament": "",
          "archetype": "",
          "appearance": "",
          "backstory": ""
        },
        "system.-=abilities": null,
        "system.-=tempphys": null,
        "system.-=tempazure": null,
        "system.-=tempmental": null,
        "flags.project-andromeda.legacyWorld312MigrationVersion": 2
      },
      "abilityUpdates": [
        {
          "_id": "7reahRcEHlTmjv7b",
          "name": "Биосенсорика",
          "update": {
            "_id": "7reahRcEHlTmjv7b",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "8wZkgpEkbVKJeQZ6",
          "name": "Умиротворение",
          "update": {
            "_id": "8wZkgpEkbVKJeQZ6",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "FJrveD6cRwOJBK19",
          "name": "Управляемая мутация",
          "update": {
            "_id": "FJrveD6cRwOJBK19",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "MlbxAoiTrqgauxlF",
          "name": "Чувство Азур",
          "update": {
            "_id": "MlbxAoiTrqgauxlF",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "QXlDhfZn6e81tKrX",
          "name": "Разговор с животными/растениями",
          "update": {
            "_id": "QXlDhfZn6e81tKrX",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "Y6cHhcvufmCeKxJT",
          "name": "Удержание",
          "update": {
            "_id": "Y6cHhcvufmCeKxJT",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "ZrzNpyE2wy67YtBh",
          "name": "Ускорение регенерации",
          "update": {
            "_id": "ZrzNpyE2wy67YtBh",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "oSvHSFGFxFSBhCmP",
          "name": "Базовая способность: Источника",
          "update": {
            "_id": "oSvHSFGFxFSBhCmP",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "qpAKh0oIUddtMJs4",
          "name": "Боевые феромоны",
          "update": {
            "_id": "qpAKh0oIUddtMJs4",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "u7Q4bitseCBmUEy0",
          "name": "Очищение",
          "update": {
            "_id": "u7Q4bitseCBmUEy0",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        }
      ]
    },
    {
      "actorId": "xX9wej1m8Arr9xKV",
      "actorName": "Лоренцо",
      "actorType": "playerCharacter",
      "migrationVersion": 2,
      "archetype": null,
      "decisions": {
        "archetype": "left-empty-for-player-choice",
        "defenses": "reset-to-rank-until-archetype-choice",
        "skillRank": "all-skills-start-at-rank-1",
        "skillValue": "preserve-old-value-clamped-to-0-4",
        "legacyAbilities": "keep-unranked-and-free-until-curated"
      },
      "changes": {
        "heroPoints": {
          "from": 5,
          "to": 3
        },
        "defenses": {
          "from": {
            "physical": 11,
            "azure": 11,
            "mental": 11
          },
          "to": {
            "fortitude": 3,
            "control": 3,
            "will": 3
          }
        },
        "skills": {
          "skills": {
            "moshch": {
              "rank": 1,
              "value": 2
            },
            "lovkost": {
              "rank": 1,
              "value": 0
            },
            "sokrytie": {
              "rank": 1,
              "value": 0
            },
            "strelba": {
              "rank": 1,
              "value": 1
            },
            "blizhniy_boy": {
              "rank": 1,
              "value": 0
            },
            "nablyudatelnost": {
              "rank": 1,
              "value": 0
            },
            "analiz": {
              "rank": 1,
              "value": 4
            },
            "khakerstvo": {
              "rank": 1,
              "value": 0
            },
            "inzheneriya": {
              "rank": 1,
              "value": 1
            },
            "dominirovanie": {
              "rank": 1,
              "value": 3
            },
            "rezonans": {
              "rank": 1,
              "value": 0
            },
            "mistika": {
              "rank": 1,
              "value": 3
            },
            "obayanie": {
              "rank": 1,
              "value": 0
            }
          },
          "mappingsApplied": [
            {
              "from": "programmirovanie",
              "to": "khakerstvo",
              "oldValue": 0,
              "migratedValue": 0,
              "clamped": false
            },
            {
              "from": "bionika",
              "to": "mistika",
              "oldValue": 3,
              "migratedValue": 3,
              "clamped": false
            }
          ],
          "unresolved": []
        },
        "abilities": [
          "Удержание",
          "Очищение",
          "Базовая способность: Источника",
          "Умиротворение",
          "Боевые феромоны",
          "Ускорение регенерации",
          "Управляемая мутация",
          "Биосенсорика",
          "Чувство Азур",
          "Разговор с животными/растениями"
        ]
      },
      "actorUpdate": {
        "system.currentRank": 3,
        "system.momentOfGlory": 3,
        "system.skills": {
          "moshch": {
            "rank": 1,
            "value": 2
          },
          "lovkost": {
            "rank": 1,
            "value": 0
          },
          "sokrytie": {
            "rank": 1,
            "value": 0
          },
          "strelba": {
            "rank": 1,
            "value": 1
          },
          "blizhniy_boy": {
            "rank": 1,
            "value": 0
          },
          "nablyudatelnost": {
            "rank": 1,
            "value": 0
          },
          "analiz": {
            "rank": 1,
            "value": 4
          },
          "khakerstvo": {
            "rank": 1,
            "value": 0
          },
          "inzheneriya": {
            "rank": 1,
            "value": 1
          },
          "dominirovanie": {
            "rank": 1,
            "value": 3
          },
          "rezonans": {
            "rank": 1,
            "value": 0
          },
          "mistika": {
            "rank": 1,
            "value": 3
          },
          "obayanie": {
            "rank": 1,
            "value": 0
          }
        },
        "system.skills.-=programmirovanie": null,
        "system.skills.-=bionika": null,
        "system.defenses": {
          "fortitude": 3,
          "control": 3,
          "will": 3
        },
        "system.defenses.-=physical": null,
        "system.defenses.-=azure": null,
        "system.defenses.-=mental": null,
        "system.tempfortitude": 0,
        "system.tempcontrol": 0,
        "system.tempwill": 0,
        "system.stress.value": 5,
        "system.stress.marked": [],
        "system.biography": {
          "feature": "",
          "weakness": "",
          "temperament": "",
          "archetype": "",
          "appearance": "",
          "backstory": ""
        },
        "system.-=abilities": null,
        "system.-=tempphys": null,
        "system.-=tempazure": null,
        "system.-=tempmental": null,
        "flags.project-andromeda.legacyWorld312MigrationVersion": 2
      },
      "abilityUpdates": [
        {
          "_id": "2xmC8jj1lCTxOUzd",
          "name": "Удержание",
          "update": {
            "_id": "2xmC8jj1lCTxOUzd",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "7LlhsnF7zTznRsZC",
          "name": "Очищение",
          "update": {
            "_id": "7LlhsnF7zTznRsZC",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "MjxMM9SbXU66tszV",
          "name": "Базовая способность: Источника",
          "update": {
            "_id": "MjxMM9SbXU66tszV",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "Q0xvXl44Yh4R9XPU",
          "name": "Умиротворение",
          "update": {
            "_id": "Q0xvXl44Yh4R9XPU",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "Urr7IgNXSwVpW3Nf",
          "name": "Боевые феромоны",
          "update": {
            "_id": "Urr7IgNXSwVpW3Nf",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "YuOA5WzSD6t34py9",
          "name": "Ускорение регенерации",
          "update": {
            "_id": "YuOA5WzSD6t34py9",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "awb0vitxbukUQ79p",
          "name": "Управляемая мутация",
          "update": {
            "_id": "awb0vitxbukUQ79p",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "kkoUfZP647uU4FWq",
          "name": "Биосенсорика",
          "update": {
            "_id": "kkoUfZP647uU4FWq",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "pgN8s1JvxWvGhbW7",
          "name": "Чувство Азур",
          "update": {
            "_id": "pgN8s1JvxWvGhbW7",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        },
        {
          "_id": "wn16PHyC7sM9gXgN",
          "name": "Разговор с животными/растениями",
          "update": {
            "_id": "wn16PHyC7sM9gXgN",
            "system.skill": "",
            "system.requiresRoll": false,
            "system.rank": "",
            "system.details.legacyWorld312MigrationVersion": {
              "version": 2,
              "originalType": "trait-source-ability",
              "keptUnrankedAndFree": true
            },
            "flags.project-andromeda.legacyWorld312MigrationVersion": 2
          }
        }
      ]
    }
  ]
};
  const report = { apply: APPLY, ready: true, actors: [], errors: [] };

  if (!game.user?.isGM) throw new Error('Миграцию может запустить только GM.');
  if (String(game.world?.id ?? '') !== '312' && String(game.world?.id ?? '') !== '312-migration') {
    throw new Error('Неверный мир: ' + (game.world?.id ?? '—'));
  }

  for (const entry of plan.actors) {
    const actor = game.actors.get(entry.actorId);
    const actorReport = { actorId: entry.actorId, actorName: entry.actorName, status: 'ready', missingItems: [] };
    report.actors.push(actorReport);
    if (!actor) {
      actorReport.status = 'missing-actor';
      report.errors.push('Не найден актёр ' + entry.actorName + ' (' + entry.actorId + ')');
      continue;
    }
    if (actor.name !== entry.actorName) {
      actorReport.status = 'name-mismatch';
      report.errors.push('Имя актёра ' + entry.actorId + ': ожидалось «' + entry.actorName + '», найдено «' + actor.name + '»');
      continue;
    }
    const completedVersion = Number(actor.getFlag(MODULE_ID, FLAG)) || 0;
    if (completedVersion >= VERSION) {
      actorReport.status = 'already-completed';
      continue;
    }
    for (const itemEntry of entry.abilityUpdates) {
      if (!actor.items.get(itemEntry._id)) actorReport.missingItems.push(itemEntry._id);
    }
    if (actorReport.missingItems.length) {
      actorReport.status = 'missing-items';
      report.errors.push('У ' + entry.actorName + ' не найдены предметы: ' + actorReport.missingItems.join(', '));
    }
  }

  report.ready = report.errors.length === 0;
  if (!APPLY || !report.ready) {
    console.table(report.actors);
    console.log('Project Andromeda migration dry-run', report, plan);
    ui.notifications[report.ready ? 'info' : 'error'](
      report.ready
        ? 'Проверка миграции прошла: изменения не применены.'
        : 'Проверка миграции нашла ошибки. См. консоль.'
    );
    return report;
  }

  for (const entry of plan.actors) {
    const actor = game.actors.get(entry.actorId);
    if (!actor || Number(actor.getFlag(MODULE_ID, FLAG)) >= VERSION) continue;
    const updates = entry.abilityUpdates
      .filter((itemEntry) => actor.items.get(itemEntry._id))
      .map((itemEntry) => itemEntry.update);
    if (updates.length) await actor.updateEmbeddedDocuments('Item', updates, { render: false });
    await actor.update(entry.actorUpdate, { render: false });
    actor.prepareData();
  }

  console.log('Project Andromeda migration applied', report, plan);
  ui.notifications.info('Миграция персонажей мира 312 завершена.');
  return report;
})();
