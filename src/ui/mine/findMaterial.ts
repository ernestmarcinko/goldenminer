import type { Material } from '../../core/items';
import type { FindKind } from '../../core/types';

/** The material of a material vein. The save validator guarantees it on every 'materialVein' find, so a miss is a bug. */
export function findMaterial(find: { kind: FindKind; material?: Material }): Material {
  if (find.material === undefined) throw new Error(`a ${find.kind} find has no material`);
  return find.material;
}
