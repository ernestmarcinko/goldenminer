export function saveProblem(reason: 'corrupt' | 'future' | 'invalid'): string {
  switch (reason) {
    case 'corrupt': return 'it is damaged';
    case 'invalid': return 'it is not a valid save from The Golden Minder';
    case 'future': return 'it was made by a newer version of the game';
  }
}
