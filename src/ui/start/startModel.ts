import { isValidCharacterName, MAX_CHARACTER_NAME } from '../../core/names';
import { isValidSeedText, MAX_SEED_TEXT } from '../../core/seed';

/** The problem with the name field, or null when it is ready to start. */
export function nameProblem(text: string): string | null {
  return isValidCharacterName(text) ? null : `Enter a name of up to ${MAX_CHARACTER_NAME} characters.`;
}

/** The problem with the seed field, or null when it is ready to start. */
export function seedProblem(text: string): string | null {
  return isValidSeedText(text) ? null : `Enter a seed of up to ${MAX_SEED_TEXT} characters.`;
}

/** Whether a Start is allowed for the two fields as typed. */
export function canStart(name: string, seed: string): boolean {
  return isValidCharacterName(name) && isValidSeedText(seed);
}
