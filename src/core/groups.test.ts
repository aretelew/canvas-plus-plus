import { describe, expect, it } from 'vitest';
import { currentGroups, type CanvasGroup } from './groups';

describe('currentGroups', () => {
  const group = (id: string, over: Partial<CanvasGroup>): CanvasGroup => ({
    id,
    name: `Group ${id}`,
    can_access: true,
    concluded: false,
    ...over,
  });

  it("keeps the listed courses' groups and those of no course", () => {
    const groups = [
      group('1', { course_id: '1' }),
      group('2', { course_id: '99' }),
      group('3', {}),
      group('4', { course_id: '1', concluded: true }),
      group('5', { course_id: '1', can_access: false }),
    ];
    expect(currentGroups(groups, [{ id: '1' }]).map(({ id }) => id)).toEqual([
      '1',
      '3',
    ]);
  });
});
