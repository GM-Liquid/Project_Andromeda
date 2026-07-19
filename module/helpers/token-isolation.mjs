import { deepClone } from './object-utils.mjs';

/**
 * Build a complete ActorDelta source from a world Actor. A full snapshot is
 * intentional: once a second token enters a scene, later edits to the world
 * actor must not leak into either token's isolated sheet.
 */
export function buildActorDeltaSnapshot(actor) {
  const source = actor?.toObject?.() ?? actor?._source ?? {};
  const snapshot = {};

  for (const key of ['name', 'type', 'img', 'system', 'items', 'effects', 'ownership', 'flags']) {
    if (!(key in source)) continue;
    snapshot[key] = deepClone(source[key]);
  }

  return snapshot;
}

/**
 * Return all scene tokens which reference a particular world Actor.
 */
export function getSceneActorTokens(scene, actorId) {
  const normalizedActorId = String(actorId ?? '').trim();
  if (!normalizedActorId) return [];

  return getCollectionContents(scene?.tokens).filter(
    (token) => String(token?.actorId ?? '').trim() === normalizedActorId
  );
}

/**
 * Describe the changes needed after a token is created.
 *
 * The first token on a scene is linked to its world actor. Creating a second
 * token snapshots the actor into both token deltas, making their sheets fully
 * independent. Token removal deliberately has no inverse operation: a lone
 * remaining token retains its isolated state.
 */
export function getTokenIsolationPlan({ scene, actor, createdToken }) {
  const actorId = actor?.id ?? createdToken?.actorId;
  const tokens = getSceneActorTokens(scene, actorId);
  if (!actorId) return [];

  const isCreatedToken = createdToken && tokens.some((token) => token.id === createdToken.id);
  if (createdToken && !isCreatedToken) return [];

  if (tokens.length === 1) {
    if (!createdToken) return [];
    return [{ token: createdToken, update: { actorLink: true, delta: {} } }];
  }

  const snapshot = buildActorDeltaSnapshot(actor);
  return tokens
    .filter((token) => !createdToken || token.id === createdToken.id || token.actorLink)
    .map((token) => ({
      token,
      update: {
        actorLink: false,
        delta: deepClone(snapshot)
      }
    }));
}

function getCollectionContents(collection) {
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection?.contents)) return collection.contents;
  if (collection?.values) return Array.from(collection.values());
  return [];
}
