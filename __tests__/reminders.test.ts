import {
  cadenceDays,
  cadenceLabel,
  capDailyReminders,
  DAILY_REMINDER_CAP,
  inferredFireHour,
  isReminderCadence,
  localDayNumber,
  logReminderBody,
  MIN_HISTORY_FOR_INFERRED_HOUR,
  owedReminderBody,
  OWED_REMINDER_MINUTE,
  planLogReminders,
  planOwedReminders,
  PLAN_HORIZON,
  REMINDER_HOUR,
  reminderClass,
  type ReminderCadence,
  type ReminderPlanEntry,
} from '../src/lib/reminders';
import { AGING_DAYS, type OpenShare, type PersonDebt } from '../src/lib/split';

/**
 * A local wall-clock instant. The planner deals in local calendar days and a local fire hour,
 * so every fixture here is built through the local-time constructor rather than an ISO string
 * (which would be parsed as UTC and skew the day boundary under a non-UTC TZ).
 */
function at(day: number, hour: number, minute = 0): Date {
  return new Date(2026, 5, day, hour, minute, 0, 0); // June 2026
}

function entry(over: Partial<ReminderPlanEntry> = {}): ReminderPlanEntry {
  return { at: at(10, 20), title: 'Pip', body: 'body', kind: 'log', ...over };
}

function debt(over: Partial<PersonDebt> = {}): PersonDebt {
  return { personId: 'p1', name: 'Ali', total: 42.5, shares: [], oldestDays: 20, ...over };
}

function share(over: Partial<OpenShare> = {}): OpenShare {
  return {
    shareId: 's1',
    personId: 'p1',
    personName: 'Ali',
    outstanding: 42.5,
    billDate: '2026-05-20',
    merchant: 'Kopitiam',
    ...over,
  };
}

describe('cadenceDays', () => {
  it('maps every cadence to its step in days', () => {
    expect(cadenceDays('daily')).toBe(1);
    expect(cadenceDays('weekly')).toBe(7);
  });

  it('returns null for off, which is what disables the whole plan', () => {
    expect(cadenceDays('off')).toBeNull();
  });
});

describe('cadenceLabel', () => {
  it('labels each cadence for the Settings pills', () => {
    expect(cadenceLabel('off')).toBe('Off');
    expect(cadenceLabel('daily')).toBe('Daily');
    expect(cadenceLabel('weekly')).toBe('Weekly');
  });
});

describe('isReminderCadence', () => {
  it('accepts the three known cadences', () => {
    expect(isReminderCadence('off')).toBe(true);
    expect(isReminderCadence('weekly')).toBe(true);
  });

  it('rejects anything a hand-edited app_meta row could hold', () => {
    expect(isReminderCadence('hourly')).toBe(false);
    expect(isReminderCadence('')).toBe(false);
    expect(isReminderCadence(null)).toBe(false);
    expect(isReminderCadence(undefined)).toBe(false);
    expect(isReminderCadence(7)).toBe(false);
  });
});

describe('localDayNumber', () => {
  it('gives consecutive days consecutive numbers', () => {
    expect(localDayNumber(at(11, 9)) - localDayNumber(at(10, 9))).toBe(1);
  });

  it('is stable across the hours of one local day', () => {
    expect(localDayNumber(at(10, 0, 1))).toBe(localDayNumber(at(10, 23, 59)));
  });
});

describe('planLogReminders', () => {
  const day10 = localDayNumber(at(10, 12));

  it('returns nothing when the reminder is off', () => {
    expect(planLogReminders({ cadence: 'off', lastLoggedDay: day10 }, at(10, 12))).toEqual([]);
  });

  it('pushes tonight past, to tomorrow, when you already logged today', () => {
    const plan = planLogReminders({ cadence: 'daily', lastLoggedDay: day10 }, at(10, 12));
    expect(plan[0].at).toEqual(at(11, REMINDER_HOUR));
  });

  it('fires tonight when you last logged days ago and it is not yet 10pm', () => {
    const plan = planLogReminders({ cadence: 'daily', lastLoggedDay: day10 - 3 }, at(10, 12));
    expect(plan[0].at).toEqual(at(10, REMINDER_HOUR));
  });

  it('rolls to tomorrow when tonight has already passed', () => {
    const plan = planLogReminders({ cadence: 'daily', lastLoggedDay: day10 - 3 }, at(10, 23));
    expect(plan[0].at).toEqual(at(11, REMINDER_HOUR));
  });

  it('rolls forward at exactly the fire time rather than scheduling in the past', () => {
    const plan = planLogReminders({ cadence: 'daily', lastLoggedDay: day10 - 3 }, at(10, REMINDER_HOUR));
    expect(plan[0].at).toEqual(at(11, REMINDER_HOUR));
  });

  it('anchors on today when nothing has ever been logged, rather than nudging immediately', () => {
    const plan = planLogReminders({ cadence: 'daily', lastLoggedDay: null }, at(10, 12));
    expect(plan[0].at).toEqual(at(11, REMINDER_HOUR));
  });

  it('spaces occurrences by the cadence', () => {
    const weekly = planLogReminders({ cadence: 'weekly', lastLoggedDay: day10 }, at(10, 12));
    expect(weekly[0].at).toEqual(at(17, REMINDER_HOUR));
    expect(weekly[1].at).toEqual(at(24, REMINDER_HOUR));
  });

  it('arms a full horizon, every entry in the future and on the hour', () => {
    const now = at(10, 12);
    for (const cadence of ['daily', 'weekly'] as ReminderCadence[]) {
      const plan = planLogReminders({ cadence, lastLoggedDay: day10 - 5 }, now);
      expect(plan).toHaveLength(PLAN_HORIZON);
      for (const entry of plan) {
        expect(entry.at.getTime()).toBeGreaterThan(now.getTime());
        expect(entry.at.getHours()).toBe(REMINDER_HOUR);
        expect(entry.at.getMinutes()).toBe(0);
      }
    }
  });

  it('ages the copy along the ladder so a later rung is not stale on arrival', () => {
    const plan = planLogReminders({ cadence: 'daily', lastLoggedDay: day10 }, at(10, 12));
    // Rung 0 fires the day after the last log, rung 6 fires seven days after it.
    expect(plan[0].body).toContain('since yesterday');
    expect(plan[6].body).toContain('7 days');
  });

  it('fires at the given fireHour/fireMinute instead of the REMINDER_HOUR default', () => {
    const plan = planLogReminders(
      { cadence: 'daily', lastLoggedDay: day10, fireHour: 19, fireMinute: 30 },
      at(10, 12)
    );
    expect(plan[0].at).toEqual(at(11, 19, 30));
  });

  it('every rung is tagged as the log kind', () => {
    const plan = planLogReminders({ cadence: 'daily', lastLoggedDay: day10 }, at(10, 12));
    expect(plan.every((e) => e.kind === 'log')).toBe(true);
  });
});

describe('inferredFireHour', () => {
  it('falls back to REMINDER_HOUR below the minimum history threshold', () => {
    const hours = Array.from({ length: MIN_HISTORY_FOR_INFERRED_HOUR - 1 }, () => 20);
    expect(inferredFireHour(hours)).toEqual({ hour: REMINDER_HOUR, minute: 0 });
  });

  it('accepts a custom fallback', () => {
    expect(inferredFireHour([], 9)).toEqual({ hour: 9, minute: 0 });
  });

  it('fires 30 minutes before the modal logging hour once there is enough history', () => {
    const hours = [20, 20, 20, 21, 9];
    expect(inferredFireHour(hours)).toEqual({ hour: 19, minute: 30 });
  });

  it('breaks a tie between equally-common hours by picking the earlier one', () => {
    const hours = [9, 9, 9, 8, 8, 8];
    expect(inferredFireHour(hours)).toEqual({ hour: 7, minute: 30 });
  });

  it('wraps back across midnight when the modal hour is 0', () => {
    const hours = [0, 0, 0, 0, 0];
    expect(inferredFireHour(hours)).toEqual({ hour: 23, minute: 30 });
  });
});

describe('planOwedReminders', () => {
  const debts = [debt()];

  it('returns nothing when switched off', () => {
    expect(
      planOwedReminders({ enabled: false, oldestOverdueDays: 30, debts }, at(10, 12))
    ).toEqual([]);
  });

  it('stays quiet one day below the aging threshold', () => {
    expect(
      planOwedReminders({ enabled: true, oldestOverdueDays: AGING_DAYS - 1, debts }, at(10, 12))
    ).toEqual([]);
  });

  it('starts chasing exactly at the aging threshold', () => {
    const plan = planOwedReminders(
      { enabled: true, oldestOverdueDays: AGING_DAYS, debts },
      at(10, 12)
    );
    expect(plan).toHaveLength(PLAN_HORIZON);
  });

  it('returns nothing when nobody owes anything, whatever the age says', () => {
    expect(
      planOwedReminders({ enabled: true, oldestOverdueDays: 99, debts: [] }, at(10, 12))
    ).toEqual([]);
  });

  it('fires weekly, offset from the log reminder so they never collide', () => {
    const plan = planOwedReminders({ enabled: true, oldestOverdueDays: 30, debts }, at(10, 12));
    expect(plan[0].at).toEqual(at(10, REMINDER_HOUR, OWED_REMINDER_MINUTE));
    expect(plan[1].at).toEqual(at(17, REMINDER_HOUR, OWED_REMINDER_MINUTE));
    expect(plan[0].at.getMinutes()).toBe(OWED_REMINDER_MINUTE);
  });

  it('rolls to the next week when tonight has already passed', () => {
    const plan = planOwedReminders({ enabled: true, oldestOverdueDays: 30, debts }, at(10, 23));
    expect(plan[0].at).toEqual(at(17, REMINDER_HOUR, OWED_REMINDER_MINUTE));
  });

  it('every rung is tagged as the owed kind and sent as Pip', () => {
    const plan = planOwedReminders({ enabled: true, oldestOverdueDays: 30, debts }, at(10, 12));
    expect(plan.every((e) => e.kind === 'owed')).toBe(true);
    expect(plan.every((e) => e.title.includes('Pip'))).toBe(true);
  });
});

describe('reminderClass', () => {
  it('classes the log reminder as routine: low urgency, skippable', () => {
    expect(reminderClass('log')).toBe('routine');
  });

  it('classes owed and commitment reminders as save: real stakes', () => {
    expect(reminderClass('owed')).toBe('save');
    expect(reminderClass('commitment')).toBe('save');
  });
});

describe('logReminderBody', () => {
  it('invites a first entry when nothing has ever been logged', () => {
    expect(logReminderBody(null)).toContain('have not logged anything yet');
  });

  it('reads naturally at a one-day gap rather than saying "1 days"', () => {
    expect(logReminderBody(1)).toContain('since yesterday');
    expect(logReminderBody(1)).not.toContain('1 days');
  });

  it('counts the days once the gap has opened up', () => {
    expect(logReminderBody(5)).toContain('5 days');
  });

  it('stays mild for a short gap', () => {
    expect(logReminderBody(3)).toBe("It's been 3 days. Your coverage is slipping.");
  });

  it('escalates to a sharper line once the gap opens past a week', () => {
    expect(logReminderBody(6)).toContain('ghosting you');
  });

  it('rotates the heavy tier between the escalated line and a self-aware fallback', () => {
    expect(logReminderBody(10)).toContain('missing persons case');
    expect(logReminderBody(11)).toContain('rehearsing this notification');
  });

  it('rotates the done tier between the escalated line and a self-aware fallback', () => {
    expect(logReminderBody(22)).toContain('acceptance now');
    expect(logReminderBody(23)).toContain('rehearsing this notification');
  });
});

describe('owedReminderBody', () => {
  it('says nothing is outstanding when nobody owes you', () => {
    expect(owedReminderBody([])).toContain('Nobody owes you');
  });

  it('names the person, the amount, and the age for a single debt in the mild tier', () => {
    const body = owedReminderBody([debt({ name: 'Ali', total: 42.5, oldestDays: 5 })]);
    expect(body).toBe('Ali has owed you RM 42.50 for 5 days. Worth a nudge.');
  });

  it('escalates to the annoyed tier past 7 days', () => {
    const body = owedReminderBody([debt({ name: 'Ali', total: 42.5, oldestDays: 20 })]);
    expect(body).toBe('Ali still owes you RM 42.50. 20 days of you being way too chill about this.');
  });

  it('escalates to the heavy tier past 20 days', () => {
    const body = owedReminderBody([debt({ name: 'Ali', total: 42.5, oldestDays: 21 })]);
    expect(body).toBe("Ali owes you RM 42.50. 21 days. At this point it's not a debt, it's a situationship.");
  });

  it('drops the joke entirely past 45 days', () => {
    const body = owedReminderBody([debt({ name: 'Ali', total: 42.5, oldestDays: 46 })]);
    expect(body).toBe(
      "Ali has owed you RM 42.50 for 46 days. Pip isn't even going to make a joke about this one. That's how bad it's gotten."
    );
  });

  it('counts one other in the singular', () => {
    expect(owedReminderBody([debt(), debt({ personId: 'p2', name: 'Siti' })])).toContain(
      'One other is waiting too'
    );
  });

  it('counts several others in the plural', () => {
    const many = [debt(), debt({ personId: 'p2' }), debt({ personId: 'p3' })];
    expect(owedReminderBody(many)).toContain('2 others are waiting too');
  });

  it('advances the age for a rung scheduled further out', () => {
    expect(owedReminderBody([debt({ oldestDays: 20 })], 7)).toContain('27 days');
  });

  it('ignores the share list, which it never reads', () => {
    const body = owedReminderBody([debt({ oldestDays: 5, shares: [share(), share({ shareId: 's2' })] })]);
    expect(body).toContain('Ali has owed you');
  });
});

describe('reminder copy never verdicts the user (ui-engagement-plan.md Step 7, item 5)', () => {
  // "You are RM 400 over budget" is the ostrich effect's ignition switch (§1). Every reminder
  // body is allowed to name an amount owed or a bill due: those are neutral facts pointing at
  // an action, but never a judgement of the user's own spending.
  const forbidden = [/over ?budget/i, /overspen/i, /you spent too much/i, /you('| a)re over/i];

  it('the log reminder never verdicts spending, across its whole tier range', () => {
    for (let d = 0; d <= 40; d++) {
      const body = logReminderBody(d);
      for (const re of forbidden) expect(body).not.toMatch(re);
    }
    expect(logReminderBody(null)).not.toMatch(forbidden[0]);
  });

  it('the owed reminder never verdicts spending, across its whole tier range', () => {
    for (let days = 0; days <= 60; days++) {
      const body = owedReminderBody([debt({ oldestDays: days })]);
      for (const re of forbidden) expect(body).not.toMatch(re);
    }
  });
});

describe('capDailyReminders', () => {
  it('leaves a day with fewer entries than the cap untouched', () => {
    const entries = [entry({ at: at(10, 20), kind: 'log' })];
    expect(capDailyReminders(entries)).toEqual(entries);
  });

  it('defaults the cap to DAILY_REMINDER_CAP', () => {
    expect(DAILY_REMINDER_CAP).toBe(2);
  });

  it('drops the routine entry in favour of two save entries on the same day', () => {
    const routine = entry({ at: at(10, 22), kind: 'log' });
    const save1 = entry({ at: at(10, 22, 5), kind: 'owed' });
    const save2 = entry({ at: at(10, 20, 0), kind: 'commitment' });
    const result = capDailyReminders([routine, save1, save2]);
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.kind !== 'log')).toBe(true);
  });

  it('keeps the earliest entries when three of the same class collide on one day', () => {
    const first = entry({ at: at(10, 9), kind: 'commitment' });
    const second = entry({ at: at(10, 12), kind: 'owed' });
    const third = entry({ at: at(10, 20), kind: 'commitment' });
    const result = capDailyReminders([third, first, second]);
    expect(result.map((e) => e.at.getHours())).toEqual([9, 12]);
  });

  it('caps each day independently', () => {
    const day1 = [entry({ at: at(10, 9), kind: 'log' }), entry({ at: at(10, 12), kind: 'owed' }), entry({ at: at(10, 20), kind: 'owed' })];
    const day2 = [entry({ at: at(11, 9), kind: 'log' })];
    const result = capDailyReminders([...day1, ...day2]);
    expect(result.filter((e) => localDayNumber(e.at) === localDayNumber(at(10, 0)))).toHaveLength(2);
    expect(result.filter((e) => localDayNumber(e.at) === localDayNumber(at(11, 0)))).toHaveLength(1);
  });

  it('respects a custom max', () => {
    const entries = [entry({ at: at(10, 9) }), entry({ at: at(10, 12) }), entry({ at: at(10, 15) })];
    expect(capDailyReminders(entries, 1)).toHaveLength(1);
  });
});
