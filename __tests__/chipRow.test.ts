import { visibleChoices } from '../src/lib/chipRow';

type Row = { id: string; name: string };

const rows = (...names: string[]): Row[] => names.map((name) => ({ id: name, name }));

describe('visibleChoices', () => {
  it('returns every item when the list already fits the cap', () => {
    const all = rows('a', 'b', 'c');
    expect(visibleChoices(all, 'a', 4)).toEqual(all);
  });

  it('keeps the first items in order when nothing outside the cap is selected', () => {
    const all = rows('a', 'b', 'c', 'd', 'e', 'f');
    expect(visibleChoices(all, 'b', 4).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('swaps a selection from beyond the cap into the last slot', () => {
    const all = rows('a', 'b', 'c', 'd', 'e', 'f');
    expect(visibleChoices(all, 'f', 4).map((r) => r.id)).toEqual(['a', 'b', 'c', 'f']);
  });

  it('shows the head of the list when nothing is selected', () => {
    const all = rows('a', 'b', 'c', 'd', 'e');
    expect(visibleChoices(all, null, 4).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignores a selected id that is not in the list', () => {
    const all = rows('a', 'b', 'c', 'd', 'e');
    expect(visibleChoices(all, 'gone', 4).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('never returns more than the cap', () => {
    const all = rows('a', 'b', 'c', 'd', 'e', 'f', 'g');
    expect(visibleChoices(all, 'g', 1).map((r) => r.id)).toEqual(['g']);
  });
});
