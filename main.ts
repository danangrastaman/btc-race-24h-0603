// Dip-and-bounce cbBTC mean-reversion bot for btc-race-24h-20261117-0603.
//
// Idea: cbBTC on 1-minute bars spends most of a day ranging a few percent, with a
// handful of sharp dips that bounce. This bot waits for a dip, waits for proof the
// dip is turning, buys it with the full cash balance, and sells on a fixed gain,
// a fixed stop, or a time backstop. It never shorts, never uses leverage, and it
// holds cash (earning nothing) whenever no dip qualifies.
//
// Entry (all four must hold on a batch that can trade):
//   1. The close is at least DIP_BPS below the highest close of the last HIGH_N
//      bars (a real dip, not noise around the high).
//   2. The close has bounced at least BOUNCE_BPS off the lowest close of the last
//      BOUNCE_WIN bars (the turn is already happening; we do not catch a falling
//      knife on its first up-tick).
//   3. Enough history has been seen (more than HIGH_N closes).
//   4. Not warming up (orders decided on warm-up batches are rejected).
//
// Exit (first one that fires, whole position, one order):
//   - gain: the position is worth GAIN_BPS more than its cost (fees included);
//   - stop: the position is worth STOP_BPS less than its cost;
//   - time: MAX_HOLD_BARS batches have passed since the fill was first seen.
//
// Everything is integer arithmetic on the bars the harness sends (closes are
// bigints at price_scale 5; quote amounts are bigints in micro-USDC). No clock,
// no network, no randomness, no files: two runs on the same data answer alike.
//
// Sizing: one full-cash buy. A full-size round trip pays about 37 bps in fees,
// slippage and impact at this pool's depth, so the 120 bps gain target clears
// the round-trip cost roughly three times over; the 150 bps stop caps a failed
// dip at about the same order as one good win.
//
// Slippage caps: buys 100 bps (a gap-up bigger than that at the fill open is not
// chased), sells 200 bps (an exit must go through even on a sharp gap-down).

import { runBars, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';

// Entry: dip below the trailing 60-bar high, with a bounce off the 5-bar low.
const HIGH_N = 60;
const DIP_BPS = 70n;
const BOUNCE_WIN = 5;
const BOUNCE_BPS = 15n;

// Exit: take profit, stop loss, time backstop (in batches since the fill).
const GAIN_BPS = 120n;
const STOP_BPS = 150n;
const MAX_HOLD_BARS = 480;

// Slippage caps, measured from the latest close at decision time.
const BUY_SLIPPAGE_BPS = 100;
const SELL_SLIPPAGE_BPS = 200;

const closes: bigint[] = [];
let entryCost: bigint | null = null;
let entrySeq = -1;

function maxOf(xs: readonly bigint[]): bigint {
  let m = xs[0] as bigint;
  for (const x of xs) if (x > m) m = x;
  return m;
}

function minOf(xs: readonly bigint[]): bigint {
  let m = xs[0] as bigint;
  for (const x of xs) if (x < m) m = x;
  return m;
}

await runBars({
  onBatch(state) {
    const bar = state.latest.get(SYMBOL);
    if (bar !== undefined) closes.push(BigInt(bar.c));

    const held = state.positions.get(SYMBOL);
    const qty = held === undefined ? 0n : held.qty;

    if (qty === 0n) {
      entryCost = null;
      entrySeq = -1;
      if (state.warmingUp || closes.length <= HIGH_N) return [];
      const close = closes[closes.length - 1] as bigint;
      const high = maxOf(closes.slice(-HIGH_N));
      const dipBps = ((high - close) * 10000n) / high;
      if (dipBps < DIP_BPS) return [];
      const low = minOf(closes.slice(-(BOUNCE_WIN + 1)));
      if (close - low < (BOUNCE_BPS * close) / 10000n) return [];
      const buy: BuyInput = {
        side: 'buy',
        symbol: SYMBOL,
        notional_quote_units: state.cash,
        max_slippage_bps: BUY_SLIPPAGE_BPS,
      };
      return [buy];
    }

    if (entryCost === null) {
      entryCost = held?.cost ?? 0n;
      entrySeq = state.seq;
    }
    const cost = entryCost as bigint;
    if (cost <= 0n) return [];
    const value = state.value(SYMBOL, qty);
    const gainBps = ((value - cost) * 10000n) / cost;
    if (gainBps >= GAIN_BPS || gainBps <= -STOP_BPS || state.seq - entrySeq >= MAX_HOLD_BARS) {
      const sell: SellInput = {
        side: 'sell',
        symbol: SYMBOL,
        qty,
        max_slippage_bps: SELL_SLIPPAGE_BPS,
      };
      return [sell];
    }
    return [];
  },
});
