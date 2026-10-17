export type CountWindow = {
  today: number;
  last7: number;
  prior7: number;
  lifetime: number;
};

export type RateWindow = {
  today: number | null;
  last7: number | null;
  prior7: number | null;
  lifetime: number | null;
};

export type SourceStatus =
  | { ok: true }
  | { ok: false; error: string };

export type UserAnalytics = {
  ok: true;
  bounds: {
    todayStart: string;
    yesterdayStart: string;
    last7Start: string;
    prior7Start: string;
  };
  signups: CountWindow;
  facecardCompleted: CountWindow;
  active: { today: number; last7: number; lifetime: number };
  genderActive7: { female: number; male: number; other: number };
  cities: Array<{
    city: string;
    active7: number;
    signups7: number;
    femaleActive7: number;
    maleActive7: number;
  }>;
  recentSignups: Array<{
    id: string;
    createdAt: string;
    lastActiveAt: string | null;
    profileCompleted: boolean;
  }>;
  recentSignupsTruncated: boolean;
  d1ByDay: Array<{ day: string; returned: number }>;
  recordedDays: string[];
};

export type CallAnalytics = {
  ok: true;
  realMeetingSessions: CountWindow;
  realMeetingPeople: CountWindow;
  callsJoinedPeople: CountWindow;
  bailRate: RateWindow;
  medianCallSeconds: RateWindow;
  beamTv: {
    hosts: CountWindow;
    qualifiedViewers: CountWindow;
    watchHours: CountWindow;
  };
  recentQualified: Array<{ userId: string; at: string }>;
  recentQualifiedTruncated: boolean;
  qualifiedPeople?: Array<{ userId: string; today: boolean; last7: boolean }>;
  qualifiedPeopleTruncated?: boolean;
};

export type MessageAnalytics = {
  ok: true;
  messagePeople: CountWindow;
};

export type PaymentAnalytics = {
  ok: true;
  payers: CountWindow;
  revenuePaise: CountWindow;
};

export type ReferralAnalytics = {
  ok: true;
  today: { signups: number; referred: number };
  last7: { signups: number; referred: number };
  prior7: { signups: number; referred: number };
  lifetime: { signups: number; referred: number };
};

export type CohortRow = {
  day: string;
  signups: number;
  facecardRate: number | null;
  realMeetingRate: number | null;
  d1Rate: number | null;
  d1Known: boolean;
};

export type ProductAnalytics = {
  ok: true;
  generatedAt: string;
  timezone: "Asia/Kolkata";
  sources: {
    users: SourceStatus;
    calls: SourceStatus;
    messages: SourceStatus;
    payments: SourceStatus;
    referrals: SourceStatus;
    cities: SourceStatus;
  };
  signups: CountWindow | null;
  facecardRate: RateWindow | null;
  active: { today: number; last7: number; lifetime: number } | null;
  callsJoinedPeople: CountWindow | null;
  realMeetingPeople: CountWindow | null;
  realMeetingSessions: CountWindow | null;
  coverage: {
    today: number | null;
    last7: number | null;
    lifetime: number | null;
    lifetimePeople: number | null;
    lifetimeSignups: number | null;
  } | null;
  bailRate: RateWindow | null;
  medianCallSeconds: RateWindow | null;
  activationLast7: number | null;
  d1: { day: string; signups: number; returned: number; rate: number | null } | null;
  retentionSplit: {
    day: string;
    withMeeting: { people: number; returned: number; rate: number | null };
    withoutMeeting: { people: number; returned: number; rate: number | null };
  } | null;
  referredRate: RateWindow | null;
  messagePeople: CountWindow | null;
  payers: CountWindow | null;
  revenuePaise: CountWindow | null;
  beamTv: CallAnalytics["beamTv"] | null;
  genderActive7: UserAnalytics["genderActive7"] | null;
  cities: Array<{
    city: string;
    active7: number;
    signups7: number;
    femaleActive7: number;
    maleActive7: number;
    realMeetings7: number | null;
  }>;
  cohorts: CohortRow[];
  notes: string[];
};

function rate(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return part / whole;
}

/** A coverage share above 1 means the two counts are not the same people. Hide it. */
function share(part: number, whole: number): number | null {
  const value = rate(part, whole);
  if (value == null || value > 1) return null;
  return value;
}

function istDayKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function buildProductAnalytics(input: {
  users: UserAnalytics | null;
  usersError: string | null;
  calls: CallAnalytics | null;
  callsError: string | null;
  messages: MessageAnalytics | null;
  messagesError: string | null;
  payments: PaymentAnalytics | null;
  paymentsError: string | null;
  referrals: ReferralAnalytics | null;
  referralsError: string | null;
  meetingCities: Array<{ city: string; people: number }> | null;
  citiesError: string | null;
  knownCoverage: { today: number; last7: number; lifetime: number } | null;
}): ProductAnalytics {
  const users = input.users;
  const calls = input.calls;
  const notes: string[] = [
    "Times use India Standard Time. Last 7 days includes today. The column before that is the previous 7 days.",
    "A real meeting is a call with two people where the first person to leave still stayed at least 2 minutes.",
    "A bail is a non-broadcast call where someone was in it for under 15 seconds.",
    "Signups and activity exclude moderator accounts. Active means the app sent a heartbeat in that window.",
  ];
  if (users?.recentSignupsTruncated) {
    notes.push("Signup cohorts are capped at the latest 4,000 people from the last 14 days.");
  }
  if (calls?.recentQualifiedTruncated) {
    notes.push("Real-meeting matching for cohorts is capped at 8,000 people from the last 21 days.");
  }

  const facecardRate: RateWindow | null = users
    ? {
        today: rate(users.facecardCompleted.today, users.signups.today),
        last7: rate(users.facecardCompleted.last7, users.signups.last7),
        prior7: rate(users.facecardCompleted.prior7, users.signups.prior7),
        lifetime: rate(users.facecardCompleted.lifetime, users.signups.lifetime),
      }
    : null;

  const known = input.knownCoverage;
  const coverage = users && calls
    ? {
        today: known
          ? share(known.today, users.active.today)
          : share(calls.realMeetingPeople.today, users.active.today),
        last7: known
          ? share(known.last7, users.active.last7)
          : share(calls.realMeetingPeople.last7, users.active.last7),
        lifetime: known ? share(known.lifetime, users.signups.lifetime) : null,
        lifetimePeople: known ? known.lifetime : null,
        lifetimeSignups: known ? users.signups.lifetime : null,
      }
    : null;
  if (calls?.qualifiedPeopleTruncated) {
    notes.push("Lifetime coverage is hidden because there are too many historical call accounts to match to signups.");
  }

  const qualifiedByUser = new Map<string, number>();
  for (const row of calls?.recentQualified ?? []) {
    const at = new Date(row.at).getTime();
    const prev = qualifiedByUser.get(row.userId);
    if (prev == null || at < prev) qualifiedByUser.set(row.userId, at);
  }

  const todayStart = users ? new Date(users.bounds.todayStart).getTime() : 0;
  const yesterdayStart = users ? new Date(users.bounds.yesterdayStart).getTime() : 0;
  const last7Start = users ? new Date(users.bounds.last7Start).getTime() : 0;
  const d1ByDay = new Map((users?.d1ByDay ?? []).map((row) => [row.day, row.returned]));
  const recordedDays = new Set(users?.recordedDays ?? []);

  const yesterdayKey = users ? istDayKey(users.bounds.yesterdayStart) : "";
  const yesterdaySignups = (users?.recentSignups ?? []).filter((person) => {
    const created = new Date(person.createdAt).getTime();
    return created >= yesterdayStart && created < todayStart;
  });

  let d1: ProductAnalytics["d1"] = null;
  if (users && yesterdayKey) {
    const fromHeartbeat = yesterdaySignups.filter(
      (person) => person.lastActiveAt && new Date(person.lastActiveAt).getTime() >= todayStart
    ).length;
    const fromTable = recordedDays.has(addDays(yesterdayKey, 1))
      ? d1ByDay.get(yesterdayKey) ?? 0
      : 0;
    const returned = Math.max(fromTable, fromHeartbeat);
    d1 = {
      day: yesterdayKey,
      signups: yesterdaySignups.length,
      returned,
      rate: rate(returned, yesterdaySignups.length),
    };
  }

  let retentionSplit: ProductAnalytics["retentionSplit"] = null;
  if (users && calls && yesterdaySignups.length > 0) {
    const withMeeting = yesterdaySignups.filter((person) => {
      const at = qualifiedByUser.get(person.id);
      return at != null && at < todayStart;
    });
    const withoutMeeting = yesterdaySignups.filter((person) => !withMeeting.includes(person));
    const cameBack = (person: (typeof yesterdaySignups)[number]) =>
      Boolean(person.lastActiveAt && new Date(person.lastActiveAt).getTime() >= todayStart);
    const withReturned = withMeeting.filter(cameBack).length;
    const withoutReturned = withoutMeeting.filter(cameBack).length;
    retentionSplit = {
      day: yesterdayKey,
      withMeeting: {
        people: withMeeting.length,
        returned: withReturned,
        rate: rate(withReturned, withMeeting.length),
      },
      withoutMeeting: {
        people: withoutMeeting.length,
        returned: withoutReturned,
        rate: rate(withoutReturned, withoutMeeting.length),
      },
    };
  }

  const last7Signups = (users?.recentSignups ?? []).filter(
    (person) => new Date(person.createdAt).getTime() >= last7Start
  );
  const activated = last7Signups.filter((person) => {
    const at = qualifiedByUser.get(person.id);
    if (at == null) return false;
    const created = new Date(person.createdAt).getTime();
    return at >= created && at <= created + 7 * 24 * 60 * 60 * 1000;
  }).length;
  const activationLast7 =
    users && calls ? rate(activated, last7Signups.length) : null;

  const cohorts: CohortRow[] = [];
  if (users) {
    const grouped = new Map<string, typeof users.recentSignups>();
    for (const person of users.recentSignups) {
      const day = istDayKey(person.createdAt);
      const list = grouped.get(day) ?? [];
      list.push(person);
      grouped.set(day, list);
    }
    const todayKey = istDayKey(users.bounds.todayStart);
    for (const [day, people] of Array.from(grouped.entries())) {
      const facecard = people.filter((person) => person.profileCompleted).length;
      const meetings = calls
        ? people.filter((person) => {
            const at = qualifiedByUser.get(person.id);
            if (at == null) return false;
            const created = new Date(person.createdAt).getTime();
            return at >= created && at <= created + 7 * 24 * 60 * 60 * 1000;
          }).length
        : null;
      const nextDay = addDays(day, 1);
      const recorded = recordedDays.has(nextDay);
      const isYesterday = day === yesterdayKey;
      const heartbeatReturned = isYesterday
        ? people.filter(
            (person) => person.lastActiveAt && new Date(person.lastActiveAt).getTime() >= todayStart
          ).length
        : null;
      const d1Known = day < todayKey && (recorded || heartbeatReturned != null);
      const d1Returned = recorded
        ? Math.max(d1ByDay.get(day) ?? 0, heartbeatReturned ?? 0)
        : heartbeatReturned;
      cohorts.push({
        day,
        signups: people.length,
        facecardRate: rate(facecard, people.length),
        realMeetingRate: meetings == null ? null : rate(meetings, people.length),
        d1Rate: d1Known && d1Returned != null ? rate(d1Returned, people.length) : null,
        d1Known,
      });
    }
    cohorts.sort((a, b) => (a.day < b.day ? 1 : -1));
  }

  const referredRate: RateWindow | null = input.referrals
    ? {
        today: rate(input.referrals.today.referred, input.referrals.today.signups),
        last7: rate(input.referrals.last7.referred, input.referrals.last7.signups),
        prior7: rate(input.referrals.prior7.referred, input.referrals.prior7.signups),
        lifetime: rate(input.referrals.lifetime.referred, input.referrals.lifetime.signups),
      }
    : null;

  const meetingByCity = new Map(
    (input.meetingCities ?? []).map((row) => [row.city, row.people])
  );
  const cities = (users?.cities ?? []).map((city) => ({
    ...city,
    realMeetings7: input.meetingCities ? meetingByCity.get(city.city) ?? 0 : null,
  }));
  for (const row of input.meetingCities ?? []) {
    if (!cities.some((city) => city.city === row.city)) {
      cities.push({
        city: row.city,
        active7: 0,
        signups7: 0,
        femaleActive7: 0,
        maleActive7: 0,
        realMeetings7: row.people,
      });
    }
  }

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    timezone: "Asia/Kolkata",
    sources: {
      users: users ? { ok: true } : { ok: false, error: input.usersError || "Users unavailable" },
      calls: calls ? { ok: true } : { ok: false, error: input.callsError || "Calls unavailable" },
      messages: input.messages
        ? { ok: true }
        : { ok: false, error: input.messagesError || "Messages unavailable" },
      payments: input.payments
        ? { ok: true }
        : { ok: false, error: input.paymentsError || "Payments unavailable" },
      referrals: input.referrals
        ? { ok: true }
        : { ok: false, error: input.referralsError || "Referrals unavailable" },
      cities: input.citiesError ? { ok: false, error: input.citiesError } : { ok: true },
    },
    signups: users?.signups ?? null,
    facecardRate,
    active: users?.active ?? null,
    callsJoinedPeople: calls?.callsJoinedPeople ?? null,
    realMeetingPeople: calls?.realMeetingPeople ?? null,
    realMeetingSessions: calls?.realMeetingSessions ?? null,
    coverage,
    bailRate: calls?.bailRate ?? null,
    medianCallSeconds: calls?.medianCallSeconds ?? null,
    activationLast7,
    d1,
    retentionSplit,
    referredRate,
    messagePeople: input.messages?.messagePeople ?? null,
    payers: input.payments?.payers ?? null,
    revenuePaise: input.payments?.revenuePaise ?? null,
    beamTv: calls?.beamTv ?? null,
    genderActive7: users?.genderActive7 ?? null,
    cities,
    cohorts,
    notes,
  };
}

export function meetingUserIdsSince(calls: CallAnalytics, sinceIso: string): string[] {
  const since = new Date(sinceIso).getTime();
  const ids = new Set<string>();
  for (const row of calls.recentQualified) {
    if (new Date(row.at).getTime() >= since) ids.add(row.userId);
  }
  return Array.from(ids);
}
