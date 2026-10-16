"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CALC_CUSTOMERS,
  CALC_FRIDAYS,
  LOOKBACK_FRIDAYS,
  SCENARIOS,
  runScenario,
  sumNights,
  type NightResult,
  type ScenarioKey,
} from "@/lib/referral-results";

export interface OwedReward {
  code: string;
  name: string;
  friend: string;
  earnedAt: string;
  expiresAt: string;
}

interface Props {
  nights: NightResult[];
  selectedNightId: string | null;
  customersWithCodes: number;
  rewardsEarned: number;
  rewardsUsed: number;
  rewardsExpired: number;
  owed: OwedReward[];
  scenarioPerFriday: Record<ScenarioKey, number>;
}

const SCENARIO_LABEL: Record<ScenarioKey, string> = { cautious: "Cautious", likely: "Likely", strong: "Strong" };
const SCENARIO_COLOR: Record<ScenarioKey, string> = { cautious: "#9aa0a6", likely: "#E8C24A", strong: "#7fd3a0" };
const KEYS: ScenarioKey[] = ["cautious", "likely", "strong"];

const dollars = (cents: number) => money(cents / 100);
function money(v: number, digits = 0) {
  return (v < 0 ? "−" : "") + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function nightLabel(date: string) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function etDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
}
function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

type InfoKey = "extra" | "guests" | "free" | "owed";

export function ReferralsClient(props: Props) {
  const router = useRouter();
  const [info, setInfo] = useState<InfoKey | null>("extra");
  const [tuned, setTuned] = useState(false);

  const { nights: allNights, selectedNightId } = props;
  const nights = selectedNightId ? allNights.filter((n) => n.id === selectedNightId) : allNights;
  const W = nights.length;
  const T = sumNights(nights);
  const all = sumNights(allNights);
  const Wall = allNights.length;

  // Scenario extra revenue per Friday; "tuned" sets Likely to the real pace and moves the others with it.
  const pace = Wall > 0 ? all.extra / 100 / Wall : 0;
  const canTune = pace > 0;
  const ratio = tuned && canTune ? pace / props.scenarioPerFriday.likely : 1;
  const perFriday = (k: ScenarioKey) => props.scenarioPerFriday[k] * ratio;
  const expected = (k: ScenarioKey) => perFriday(k) * W;

  const actual = T.extra / 100;
  const vsLikely = actual - expected("likely");
  const likelyGuests = Math.round((runScenario(SCENARIOS.likely).guests / CALC_FRIDAYS) * W);
  const freeCount = T.guests + T.rewardsUsed;
  const freeValue = T.guestDiscount + T.rewardDiscount;
  const periodName = selectedNightId ? nightLabel(nights[0].date) : plural(W, "Friday", "Fridays");

  function pickPeriod(value: string) {
    router.push(value ? `/admin/referrals?night=${value}` : "/admin/referrals");
  }

  return (
    <div className="rf" style={{ paddingTop: 32 }}>
      <style>{CSS}</style>

      <div className="rf-top">
        <h1 className="font-display">Referrals</h1>
        <span className="rf-meta">Friday Night Take · since Oct 16 · {plural(Wall, "Friday", "Fridays")}</span>
        <span className="rf-spacer" />
        <label className="rf-pick">
          <span className="rf-sr">Show</span>
          <select value={selectedNightId ?? ""} onChange={(e) => pickPeriod(e.target.value)}>
            <option value="">Since launch</option>
            {[...allNights].reverse().map((n) => (
              <option key={n.id} value={n.id}>
                {nightLabel(n.date)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {Wall === 0 ? (
        <section className="rf-card">
          <p className="rf-empty">
            The first Friday since the referral program launched hasn&apos;t happened yet. After it does, this page shows the
            guests who ordered, the free pizzas given, and how the money compares with the calculator&apos;s guesses.
          </p>
        </section>
      ) : (
        <>
          <Track actual={actual} expected={expected} W={W} tuned={tuned && canTune} lead={selectedNightId ? `On ${periodName} you were` : "So far you're"} />

          <div className="rf-kpis">
            <Kpi id="extra" label="Extra revenue" value={money(actual)} info={info} setInfo={setInfo}>
              <span className={vsLikely >= 0 ? "rf-up" : "rf-dn"}>
                {vsLikely >= 0 ? "+" : "−"}
                {money(Math.abs(vsLikely))}
              </span>{" "}
              vs. {tuned && canTune ? "your pace" : "Likely"}
            </Kpi>
            <Kpi id="guests" label="New customers" value={String(T.guests)} info={info} setInfo={setInfo}>
              guests who ordered · Likely: {likelyGuests}
            </Kpi>
            <Kpi id="free" label="Free pizzas given" value={String(freeCount)} info={info} setInfo={setInfo}>
              {dollars(freeValue)} at menu price
            </Kpi>
            <Kpi id="owed" label="Rewards waiting" value={String(props.owed.length)} info={info} setInfo={setInfo}>
              of {props.rewardsEarned} earned so far
            </Kpi>
          </div>

          {info && (
            <Explain
              which={info}
              T={T}
              W={W}
              periodName={periodName}
              likely={expected("likely")}
              tuned={tuned && canTune}
              likelyGuests={likelyGuests}
              earned={props.rewardsEarned}
              used={props.rewardsUsed}
              expired={props.rewardsExpired}
              owed={props.owed.length}
              onClose={() => setInfo(null)}
            />
          )}

          <div className="rf-split">
            <section className="rf-card">
              <h2>Extra revenue, added up Friday by Friday</h2>
              <Chart nights={allNights} perFriday={perFriday} />
              <div className="rf-legend">
                <span><i className="solid" />Actual</span>
                {KEYS.map((k) => (
                  <span key={k}><i style={{ borderColor: SCENARIO_COLOR[k] }} />{SCENARIO_LABEL[k]}{k === "likely" && tuned && canTune ? " (your pace)" : ""}</span>
                ))}
              </div>
            </section>
            <section className="rf-card">
              <h2>Each Friday</h2>
              <div className="rf-tw">
                <table className="rf-table">
                  <thead>
                    <tr><th>Friday</th><th className="r">Guests</th><th className="r">Rewards used</th><th className="r">Free pizzas</th><th className="r">Extra $</th></tr>
                  </thead>
                  <tbody>
                    {[...allNights].reverse().map((n) => (
                      <tr key={n.id} className={n.id === selectedNightId ? "sel" : undefined}>
                        <td><a href={`/admin/referrals?night=${n.id}`}>{nightLabel(n.date)}</a></td>
                        <td className="r">{n.guests}</td>
                        <td className="r">{n.rewardsUsed}</td>
                        <td className="r">{n.guests + n.rewardsUsed}</td>
                        <td className="r">{dollars(n.extra)}<small>{tuned && canTune ? "Pace" : "Likely"} {money(perFriday("likely"))}</small></td>
                      </tr>
                    ))}
                    <tr className="tot">
                      <td>Total</td>
                      <td className="r">{all.guests}</td>
                      <td className="r">{all.rewardsUsed}</td>
                      <td className="r">{all.guests + all.rewardsUsed}</td>
                      <td className="r">{dollars(all.extra)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <Rates
            all={all}
            Wall={Wall}
            customers={props.customersWithCodes}
            earned={props.rewardsEarned}
            used={props.rewardsUsed}
            tuned={tuned}
            canTune={canTune}
            setTuned={setTuned}
          />

          <section className="rf-card">
            <h2>Rewards waiting to be used</h2>
            {props.owed.length === 0 ? (
              <p className="rf-empty">No rewards are waiting. A customer earns one when their guest&apos;s order is picked up.</p>
            ) : (
              <div className="rf-owed">
                {props.owed.map((r, i) => (
                  <div key={i} className="rf-owed-row">
                    <span className="rf-code">{r.code}</span>
                    <span className="rf-who"><b>{r.name}</b><small>guest: {r.friend}, {etDate(r.earnedAt)}</small></span>
                    <span className="rf-exp">until {etDate(r.expiresAt)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="rf-meta">
              {plural(props.owed.length, "free pizza", "free pizzas")} owed. Full list in <a href="/admin/rewards">Rewards ›</a>
            </p>
          </section>

          <p className="rf-foot">
            Extra revenue counts guest orders after their free pizza, reward orders from customers who hadn&apos;t ordered in the{" "}
            {LOOKBACK_FRIDAYS} Fridays before, and later full-price orders from guests, minus every free pizza. The scenarios come
            from the revenue calculator: Likely means 14 of {CALC_CUSTOMERS} customers share, 3 guests each, 20% order, spread
            evenly across {CALC_FRIDAYS} Fridays.
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({
  id, label, value, info, setInfo, children,
}: { id: InfoKey; label: string; value: string; info: InfoKey | null; setInfo: (k: InfoKey | null) => void; children: React.ReactNode }) {
  const on = info === id;
  return (
    <div className={`rf-kpi${on ? " on" : ""}`}>
      <small>
        {label}
        <button type="button" className="rf-i" aria-expanded={on} aria-label={`How ${label.toLowerCase()} is worked out`} onClick={() => setInfo(on ? null : id)}>
          i
        </button>
      </small>
      <b>{value}</b>
      <em>{children}</em>
    </div>
  );
}

function Explain(p: {
  which: InfoKey; T: ReturnType<typeof sumNights>; W: number; periodName: string; likely: number; tuned: boolean; likelyGuests: number;
  earned: number; used: number; expired: number; owed: number; onClose: () => void;
}) {
  const { T } = p;
  let n = 0;
  const step = (text: string, eq?: string) => (
    <li key={n++}>{text}{eq && <span className="rf-eq">{eq}</span>}</li>
  );
  let title = "";
  let steps: React.ReactNode[] = [];
  let so = "";

  if (p.which === "extra") {
    const total = T.extra;
    title = `How the ${dollars(total)} adds up`;
    steps = [
      step(`${plural(T.guests, "guest", "guests")} ordered ${plural(T.guestPizzas, "pizza", "pizzas")}, worth this much on the menu.`, `+${dollars(T.guestSubtotal)}`),
      step("Each guest got their cheaper pizza free.", `−${dollars(T.guestDiscount)}`),
      step(
        `${plural(T.rewardsUsed, "customer", "customers")} used a reward. ${T.rewardExtra} of them hadn't ordered in the ${LOOKBACK_FRIDAYS} Fridays before, so those orders are new money.`,
        `${plural(T.rewardExtraPizzas, "pizza", "pizzas")} = +${dollars(T.rewardExtraSubtotal)}`
      ),
      step("Every used reward is one free pizza, even for customers who would have ordered anyway.", `−${dollars(T.rewardDiscount)}`),
      step(`${plural(T.back, "order", "orders")} came from guests coming back and paying full price.`, `+${dollars(T.backSubtotal)}`),
      step(
        "Add it all up.",
        `${dollars(T.guestSubtotal)} − ${dollars(T.guestDiscount)} + ${dollars(T.rewardExtraSubtotal)} − ${dollars(T.rewardDiscount)} + ${dollars(T.backSubtotal)} = ${dollars(total)}`
      ),
    ];
    so = `That's ${dollars(total)} more than ${p.periodName} would have made without the program. ${p.tuned ? "Your pace" : "Likely"} expected ${money(p.likely)}.`;
  } else if (p.which === "guests") {
    title = "Where the new customers come from";
    steps = [
      step(`${plural(T.guests, "guest", "guests")} used a customer's code on their first order.`),
      step("A guest's first paid order makes them a customer, with a code of their own to share."),
      step(`Likely guessed 8 guests over 4 Fridays, which is 2 a Friday.`, `2 × ${plural(p.W, "Friday", "Fridays")} = ${p.likelyGuests}`),
    ];
    so = `${plural(T.guests, "new customer", "new customers")} in ${p.periodName}.`;
  } else if (p.which === "free") {
    title = "Where the free pizzas go";
    steps = [
      step("Every guest gets one free pizza on their first order.", `${plural(T.guests, "guest", "guests")} = ${T.guests} free`),
      step("Every reward a customer uses is one more free pizza.", `${plural(T.rewardsUsed, "reward", "rewards")} = ${T.rewardsUsed} free`),
      step("Add them up.", `${T.guests} + ${T.rewardsUsed} = ${T.guests + T.rewardsUsed} free pizzas`),
      step("On the menu, those pizzas are worth this much. That's money you didn't collect.", dollars(T.guestDiscount + T.rewardDiscount)),
    ];
    so = `${plural(T.guests + T.rewardsUsed, "pizza", "pizzas")} given away in ${p.periodName}.`;
  } else {
    title = "How many rewards are still out there";
    steps = [
      step("A customer earns a reward each time a guest's order is picked up.", `${plural(p.earned, "reward", "rewards")} earned`),
      step("Some have been used on a later order.", `−${p.used} used`),
      step("Rewards last 60 days. Any not used by then expire.", `−${p.expired} expired`),
      step("What's left is still waiting.", `${p.earned} − ${p.used} − ${p.expired} = ${p.owed}`),
    ];
    so = `${plural(p.owed, "free pizza", "free pizzas")} you still owe. This counts every Friday since launch.`;
  }

  return (
    <section className="rf-explain" aria-live="polite">
      <h3 className="font-display">{title}</h3>
      <ol>{steps}</ol>
      <p className="rf-so">{so}</p>
      <button type="button" className="rf-close" onClick={p.onClose}>Close</button>
    </section>
  );
}

function Track({ actual, expected, W, tuned, lead }: { actual: number; expected: (k: ScenarioKey) => number; W: number; tuned: boolean; lead: string }) {
  const c = expected("cautious"), l = expected("likely"), s = expected("strong");
  // Cautious sits at 0%, Likely at 52%, Strong at 100%
  const pos = (v: number) => {
    const p = v <= l ? (52 * (v - c)) / Math.max(l - c, 1) : 52 + (48 * (v - l)) / Math.max(s - l, 1);
    return Math.max(0, Math.min(100, p));
  };
  const likelyName = tuned ? "your pace" : "Likely";
  let phrase: string;
  if (actual < c) phrase = "below Cautious";
  else if (Math.abs(actual - l) <= l * 0.1) phrase = `right on ${likelyName}`;
  else if (actual < l) phrase = actual > (c + l) / 2 ? `a bit under ${likelyName}` : "just above Cautious";
  else if (actual < s) phrase = `above ${likelyName}`;
  else phrase = "above Strong";
  const you = pos(actual);
  const youCrowded = [0, 52, 100].some((t) => Math.abs(t - you) < 9);

  return (
    <section className="rf-track">
      <div className="rf-track-hd">
        <b>{lead} tracking {phrase}</b>
        <span className="rf-meta">Extra revenue over {plural(W, "Friday", "Fridays")}: you {money(actual)}</span>
      </div>
      <div className="rf-scale" aria-hidden="true">
        <div className="rf-ln" />
        <span className="rf-tk" style={{ left: "0%" }}>Cautious {money(c)}</span>
        <span className="rf-tk" style={{ left: "52%" }}>{tuned ? "Your pace" : "Likely"} {money(l)}</span>
        <span className="rf-tk" style={{ left: "100%" }}>Strong {money(s)}</span>
        {!youCrowded && <span className="rf-tk you" style={{ left: `${you}%` }}>You {money(actual)}</span>}
        <span className="rf-dot" style={{ left: `${you}%` }} />
      </div>
    </section>
  );
}

function Chart({ nights, perFriday }: { nights: NightResult[]; perFriday: (k: ScenarioKey) => number }) {
  const n = Math.max(nights.length, CALC_FRIDAYS);
  const Wd = 520, H = 230, L = 50, R = 74, Tp = 16, B = 30;
  const cum: number[] = [0];
  nights.forEach((x) => cum.push(cum[cum.length - 1] + x.extra / 100));
  const top = Math.max(...cum, perFriday("likely") * n) * 1.6 || 100;
  const step = niceStep(top);
  const maxV = Math.ceil(top / step) * step;
  const x = (i: number) => L + ((Wd - L - R) * i) / n;
  const y = (v: number) => Tp + (H - Tp - B) * (1 - Math.max(0, Math.min(v, maxV)) / maxV);
  const ticks: number[] = [];
  for (let t = 0; t <= maxV + 0.01; t += step) ticks.push(t);
  const last = cum.length - 1;

  return (
    <svg viewBox={`0 0 ${Wd} ${H}`} className="rf-chart" role="img" aria-label="Extra revenue added up by Friday, actual against the scenarios">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={Wd - R} y1={y(t)} y2={y(t)} stroke="#F8EAD51a" />
          <text x={L - 6} y={y(t) + 4} fontSize="11" textAnchor="end" fill="#F8EAD566">{money(t)}</text>
        </g>
      ))}
      <text x={x(0)} y={H - 10} fontSize="11" textAnchor="middle" fill="#F8EAD566">Start</text>
      {nights.map((nt, i) => (
        <text key={nt.id} x={x(i + 1)} y={H - 10} fontSize="11" textAnchor="middle" fill="#F8EAD566">{nightLabel(nt.date)}</text>
      ))}
      {KEYS.map((k) => {
        const end = Math.min(n, maxV / Math.max(perFriday(k), 0.01));
        const ey = perFriday(k) * end;
        return (
          <g key={k}>
            <line x1={x(0)} y1={y(0)} x2={x(end)} y2={y(ey)} stroke={SCENARIO_COLOR[k]} strokeWidth="2" strokeDasharray="5 4" />
            <text x={x(end) + 6} y={y(ey) + 4} fontSize="11" fontWeight="700" fill={SCENARIO_COLOR[k]}>{SCENARIO_LABEL[k]}</text>
          </g>
        );
      })}
      <polyline points={cum.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke="#F8EAD5" strokeWidth="3" strokeLinejoin="round" />
      {cum.slice(1).map((v, i) => <circle key={i} cx={x(i + 1)} cy={y(v)} r="4" fill="#F8EAD5" />)}
      <text x={x(last) + 8} y={y(cum[last]) + 16} fontSize="12" fontWeight="800" fill="#F8EAD5">{money(cum[last])}</text>
    </svg>
  );
}

function niceStep(top: number) {
  const raw = top / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? p * 10;
}

function Rates(p: {
  all: ReturnType<typeof sumNights>; Wall: number; customers: number; earned: number; used: number;
  tuned: boolean; canTune: boolean; setTuned: (v: boolean) => void;
}) {
  const sc = (k: ScenarioKey) => SCENARIOS[k];
  const scGuests = (k: ScenarioKey) => runScenario(sc(k)).guests / CALC_FRIDAYS / CALC_CUSTOMERS;
  const { all } = p;
  const pct = (v: number) => `${Math.round(v)}%`;
  const rows: { label: string; how: string; values: Record<ScenarioKey, number>; actual: number | null; fmt: (v: number) => string }[] = [
    {
      label: "Guest orders per customer, each Friday",
      how: `${all.guests} guests ÷ ${p.Wall} Fridays ÷ ${p.customers} customers`,
      values: { cautious: scGuests("cautious"), likely: scGuests("likely"), strong: scGuests("strong") },
      actual: p.customers > 0 && p.Wall > 0 ? all.guests / p.Wall / p.customers : null,
      fmt: (v) => v.toFixed(2),
    },
    {
      label: "Pizzas per guest order",
      how: `${all.guestPizzas} pizzas ÷ ${all.guests} orders`,
      values: { cautious: sc("cautious").ppo, likely: sc("likely").ppo, strong: sc("strong").ppo },
      actual: all.guests > 0 ? all.guestPizzas / all.guests : null,
      fmt: (v) => v.toFixed(1),
    },
    {
      label: "Rewards used",
      how: `${p.used} of ${p.earned} earned`,
      values: { cautious: sc("cautious").redeem, likely: sc("likely").redeem, strong: sc("strong").redeem },
      actual: p.earned > 0 ? (p.used / p.earned) * 100 : null,
      fmt: pct,
    },
    {
      label: "Rewards that brought an extra order",
      how: `${all.rewardExtra} of ${all.rewardsUsed} used rewards`,
      values: { cautious: sc("cautious").incr, likely: sc("likely").incr, strong: sc("strong").incr },
      actual: all.rewardsUsed > 0 ? (all.rewardExtra / all.rewardsUsed) * 100 : null,
      fmt: pct,
    },
    {
      label: "Guests coming back at full price",
      how: `${all.back} return orders from ${all.guests} guests`,
      values: { cautious: sc("cautious").ret, likely: sc("likely").ret, strong: sc("strong").ret },
      actual: all.guests > 0 ? (all.back / all.guests) * 100 : null,
      fmt: pct,
    },
  ];
  const nearest = (r: (typeof rows)[number]) =>
    r.actual === null ? null : KEYS.reduce((best, k) => (Math.abs(r.values[k] - r.actual!) < Math.abs(r.values[best] - r.actual!) ? k : best), "likely" as ScenarioKey);

  return (
    <section className="rf-card">
      <h2>Your real numbers vs. the guesses</h2>
      <div className="rf-tw">
        <table className="rf-table rf-rates">
          <thead>
            <tr><th>What we count</th><th className="r">Cautious</th><th className="r">Likely</th><th className="r">Strong</th><th className="r">Actual</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const near = nearest(r);
              return (
                <tr key={r.label}>
                  <td>{r.label}<small>{r.how}</small></td>
                  {KEYS.map((k) => <td key={k} className="r">{r.fmt(r.values[k])}</td>)}
                  <td className="r rf-act">{r.actual === null ? "Not yet" : r.fmt(r.actual)}</td>
                  <td>{near && <span className={`rf-near ${near}`}>near {SCENARIO_LABEL[near]}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <label className={`rf-tune${p.canTune ? "" : " off"}`}>
        <input type="checkbox" checked={p.tuned && p.canTune} disabled={!p.canTune} onChange={(e) => p.setTuned(e.target.checked)} />
        <span className="rf-switch" aria-hidden="true" />
        {p.canTune
          ? "Set Likely to my real pace on the bar and chart. Cautious and Strong move with it."
          : "Once the program brings in extra revenue, you can set Likely to your real pace here."}
      </label>
      <p className="rf-meta">
        We can&apos;t see codes that were shared but never used, so how many customers share and how many guests they invite are
        combined into one number we can count: guest orders per customer.
      </p>
    </section>
  );
}

const CSS = `
.rf { display: grid; gap: 16px; max-width: 1100px; }
.rf h1 { font-size: 28px; font-weight: 900; margin: 0; }
.rf h2 { font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #F8EAD5a6; margin: 0; }
.rf a { color: inherit; }
.rf-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.rf-meta { color: #F8EAD599; font-size: 12.5px; margin: 0; }
.rf-spacer { flex: 1; }
.rf-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.rf-pick select { background: #2E3236; color: #F8EAD5; border: 1px solid #F8EAD526; border-radius: 12px; padding: 8px 12px; font: 700 13px var(--font-archivo), sans-serif; }
.rf-card { background: #484D52; border: 1px solid #F8EAD510; border-radius: 22px; padding: 16px 18px; display: grid; gap: 12px; min-width: 0; }
.rf-empty { color: #F8EAD599; font-size: 14px; margin: 0; }
.rf-track { background: #484D52; border: 1px solid #F8EAD510; border-radius: 16px; padding: 14px 18px 12px; display: grid; gap: 6px; }
.rf-track-hd { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.rf-track-hd b { font-size: 15px; }
.rf-scale { position: relative; height: 44px; margin: 0 44px; }
.rf-ln { position: absolute; left: 0; right: 0; top: 8px; height: 6px; border-radius: 6px; background: linear-gradient(90deg, #9aa0a655, #E8C24A66, #7fd3a066); }
.rf-tk { position: absolute; top: 22px; transform: translateX(-50%); font-size: 11px; font-weight: 700; color: #F8EAD5a6; white-space: nowrap; }
.rf-tk::before { content: ""; position: absolute; left: 50%; top: -16px; width: 2px; height: 12px; background: #F8EAD566; }
.rf-tk.you { color: #F8EAD5; }
.rf-tk.you::before { display: none; }
.rf-dot { position: absolute; top: 4px; width: 14px; height: 14px; border-radius: 50%; background: #F8EAD5; border: 3px solid #2E3236; box-shadow: 0 0 0 2px #F8EAD5; transform: translateX(-50%); }
.rf-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
.rf-kpi { background: #484D52; border: 1px solid #F8EAD510; border-radius: 16px; padding: 14px 16px; display: grid; gap: 2px; }
.rf-kpi.on { border-color: #C9A227; box-shadow: 0 0 0 1px #C9A227; }
.rf-kpi small { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #F8EAD566; display: flex; align-items: center; gap: 8px; }
.rf-kpi b { font-family: var(--font-fraunces), serif; font-weight: 900; font-size: 30px; line-height: 1.1; font-variant-numeric: tabular-nums; }
.rf-kpi em { font-style: normal; font-size: 12px; color: #F8EAD599; }
.rf-up { color: #7fd3a0; font-weight: 700; } .rf-dn { color: #f0a0a0; font-weight: 700; }
.rf-i { font: italic 900 11px/1 var(--font-fraunces), serif; width: 22px; height: 22px; border-radius: 100px; border: 1.5px solid #C9A227; color: #E8C24A; background: transparent; cursor: pointer; padding: 0; display: inline-grid; place-items: center; text-transform: none; letter-spacing: 0; }
.rf-kpi.on .rf-i { background: #C9A227; color: #2E3236; }
.rf-i:focus-visible, .rf-close:focus-visible, .rf-pick select:focus-visible { outline: 2px solid #E8C24A; outline-offset: 2px; }
.rf-explain { background: #2E3236; border: 1.5px solid #C9A227; border-radius: 16px; padding: 16px 18px; display: grid; gap: 10px; }
.rf-explain h3 { font-size: 18px; font-weight: 900; margin: 0; }
.rf-explain ol { margin: 0; padding-left: 22px; list-style: decimal; display: grid; gap: 8px; font-size: 14px; }
.rf-eq { display: block; font-weight: 700; color: #E8C24A; font-variant-numeric: tabular-nums; }
.rf-so { margin: 0; font-weight: 700; font-size: 14px; }
.rf-close { justify-self: start; background: transparent; color: #F8EAD5; border: 1px solid #F8EAD533; border-radius: 100px; padding: 5px 14px; font: 600 13px var(--font-archivo), sans-serif; cursor: pointer; }
.rf-split { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 16px; align-items: start; }
@media (max-width: 900px) { .rf-split { grid-template-columns: minmax(0, 1fr); } }
.rf-chart { width: 100%; height: auto; display: block; }
.rf-chart text { font-family: var(--font-archivo), sans-serif; }
.rf-legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; color: #F8EAD5a6; }
.rf-legend i { display: inline-block; width: 14px; height: 0; border-top: 2px dashed; margin-right: 6px; vertical-align: 3px; }
.rf-legend i.solid { border-top: 3px solid #F8EAD5; }
.rf-tw { overflow-x: auto; }
.rf-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.rf-table th { text-align: left; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: #F8EAD566; font-weight: 700; padding: 6px 8px; white-space: nowrap; }
.rf-table td { padding: 9px 8px; border-top: 1px solid #F8EAD514; vertical-align: top; }
.rf-table .r { text-align: right; }
.rf-table small { display: block; font-size: 11px; color: #F8EAD566; }
.rf-table tr.sel td { background: #F8EAD50d; }
.rf-table tr.tot td { font-weight: 800; border-top: 2px solid #F8EAD540; }
.rf-rates td:first-child { min-width: 220px; }
.rf-act { font-weight: 800; }
.rf-near { font-size: 10.5px; font-weight: 800; border-radius: 100px; padding: 2px 8px; white-space: nowrap; }
.rf-near.cautious { background: #9aa0a633; color: #d5d9dd; } .rf-near.likely { background: #E8C24A2b; color: #E8C24A; } .rf-near.strong { background: #2F7D4F44; color: #7fd3a0; }
.rf-tune { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #F8EAD5cc; cursor: pointer; position: relative; }
.rf-tune.off { cursor: default; color: #F8EAD577; }
.rf-tune input { position: absolute; opacity: 0; width: 34px; height: 20px; margin: 0; cursor: inherit; }
.rf-switch { width: 34px; height: 20px; border-radius: 100px; background: #F8EAD526; position: relative; flex: none; transition: background .15s; }
.rf-switch::after { content: ""; position: absolute; left: 3px; top: 3px; width: 14px; height: 14px; border-radius: 50%; background: #F8EAD5; transition: left .15s; }
.rf-tune input:checked + .rf-switch { background: #2F7D4F; }
.rf-tune input:checked + .rf-switch::after { left: 17px; }
.rf-tune input:focus-visible + .rf-switch { outline: 2px solid #E8C24A; outline-offset: 2px; }
.rf-owed { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); column-gap: 24px; }
.rf-owed-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid #F8EAD512; }
.rf-code { font-family: ui-monospace, Menlo, monospace; font-weight: 700; font-size: 12px; background: #E8C24A22; color: #E8C24A; border-radius: 8px; padding: 3px 8px; }
.rf-who { display: grid; min-width: 0; }
.rf-who small { color: #F8EAD588; font-size: 12px; }
.rf-exp { color: #F8EAD577; font-size: 12px; white-space: nowrap; }
.rf-foot { color: #F8EAD577; font-size: 12.5px; margin: 0; max-width: 760px; }
@media (max-width: 600px) {
  .rf-scale { margin: 0 34px; }
  .rf-tk { font-size: 10px; }
  .rf-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rf-kpi b { font-size: 24px; }
}
@media (prefers-reduced-motion: reduce) { .rf-switch, .rf-switch::after { transition: none; } }
`;
