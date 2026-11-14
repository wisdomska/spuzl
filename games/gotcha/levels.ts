/**
 * Gotcha levels. The ladder (LEVELS) is games/gotcha/rooms.ts: thirty single-screen troll rooms, played one per
 * level in Levels mode and drawn by seed for Daily and free-play courses.
 *
 * LEGACY_ROOMS are the rooms Gotcha used before (short hand rooms, set pieces and the long generated rooms). They
 * are out of every new course, but courses already scheduled may still name them, so they stay playable and
 * verifiable with their old scripts (legacy-solutions.json).
 */
import type { LevelDef } from "@/phaser/sim/level";
import { BASE_CONFIG, type PlatformerConfig } from "@/phaser/sim/platformer";
import { GENERATED } from "./levels.generated";
import { LEGACY_HAND, LEGACY_SET_PIECES } from "./legacy";
import { GUIDES, ROOMS_LADDER } from "./rooms";

/**
 * Gotcha physics: free run left and right, variable jump. The jump reaches about 3.2 tiles (the shared base reaches
 * 2.7), so a 2-tile step asks for about 60 % of it: the rooms trick you, they never ask for a perfect jump
 * (logic.test.ts holds every room to a handicapped version of this, see humanHandicap).
 */
export const CONFIG: PlatformerConfig = { ...BASE_CONFIG, jumpVel: 1420 };

/** The physics the legacy rooms were made and scripted for (courses scheduled before the rebuild). */
export const LEGACY_CONFIG: PlatformerConfig = { ...BASE_CONFIG };

/** The hand-designed ladder, Level 1 first (lib/game/levels.test.ts treats these as hand rooms). */
export const HAND_LEVELS: LevelDef[] = ROOMS_LADDER;

/** No set pieces any more: the last rooms of the ladder are the finales. */
export const SET_PIECES: LevelDef[] = [];

/** Rooms from before the ladder was rebuilt, kept so old scheduled courses still play and verify. */
export const LEGACY_ROOMS: LevelDef[] = [...LEGACY_HAND, ...LEGACY_SET_PIECES, ...GENERATED];

/** Every room any course may name. */
export const ROOMS: LevelDef[] = [...ROOMS_LADDER, ...LEGACY_ROOMS];

/** Every level in ladder order (Level 1 first). */
export const LEVELS: LevelDef[] = ROOMS_LADDER;

/** Level ids Daily and free-play courses draw from, in difficulty order. */
export const DAILY_POOL: string[] = LEVELS.map((l) => l.id);

export { GUIDES };
