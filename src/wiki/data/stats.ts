import { newGame } from '../../core/newGame';
import { deriveCharacterSheet, type CharacterSheet } from '../../core/stats';

/**
 * A fresh, level-1 character's sheet, derived by the same code the game's Character sheet uses. The wiki never types a
 * value by hand: the labels, formats and base numbers all come from `deriveCharacterSheet`.
 */
export function freshCharacterSheet(): CharacterSheet {
  return deriveCharacterSheet(newGame(0, 0));
}
