import { describe, it, expect } from 'vitest';
import { MOVES } from '@rps/shared';
import { classicMeta } from '../src/skins/classic/meta';
import { fighterMeta } from '../src/skins/fighter/meta';
import { spellMeta } from '../src/skins/spell/meta';
import type { SkinMeta } from '../src/skins/types';

const ALL_METAS: SkinMeta[] = [classicMeta, fighterMeta, spellMeta];

describe('skin registry invariants', () => {
  it('has unique ids and display names', () => {
    const ids = ALL_METAS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(ALL_METAS.map((m) => [m.id, m] as const))(
    '%s defines every abstract move with label and icon',
    (_id, meta) => {
      for (const move of MOVES) {
        expect(meta.moves[move].label.length).toBeGreaterThan(0);
        expect(meta.moves[move].icon.length).toBeGreaterThan(0);
      }
      // Labels must be distinct within a skin.
      const labels = MOVES.map((m) => meta.moves[m].label);
      expect(new Set(labels).size).toBe(3);
    }
  );

  it('classic maps A/B/C to Rock/Paper/Scissors', () => {
    expect(classicMeta.moves.A.label).toBe('Rock');
    expect(classicMeta.moves.B.label).toBe('Paper');
    expect(classicMeta.moves.C.label).toBe('Scissors');
  });

  it('fighter maps A/B/C to Kick/Punch/Block', () => {
    expect(fighterMeta.moves.A.label).toBe('Kick');
    expect(fighterMeta.moves.B.label).toBe('Punch');
    expect(fighterMeta.moves.C.label).toBe('Block');
  });

  it('spell maps A/B/C to Fire/Water/Leaf', () => {
    expect(spellMeta.moves.A.label).toBe('Fire');
    expect(spellMeta.moves.B.label).toBe('Water');
    expect(spellMeta.moves.C.label).toBe('Leaf');
  });

  it('skins declare layouts', () => {
    expect(classicMeta.layout).toBe('stacked');
    expect(fighterMeta.layout).toBe('arena');
    expect(spellMeta.layout).toBe('arena');
  });
});
