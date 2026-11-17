# Dip-and-bounce cbBTC trading bot

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/danangrastaman/btc-race-24h-0603/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/danangrastaman/btc-race-24h-0603/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

Entry for make.fun `btc-race-24h-20261117-0603` — "Race a BTC trading bot live
for 24 hours". Simulation only: the bot trades paper USDC against 1-minute
cbBTC bars from an Orca Whirlpool on Solana. It starts with $1,000.

## Run it

```sh
node main.ts
```

## Strategy

Mean reversion on dips, with proof the dip is turning before buying:

- **Entry** — buy with the full cash balance when, on one batch, the close is
  at least 70 bps below the highest close of the last 60 bars **and** the close
  has already bounced at least 15 bps off the lowest close of the last 6 bars.
  The bounce rule is the point: the bot never buys a falling knife on its first
  up-tick, it buys a dip that has started to turn.
- **Exit** — sell the whole position when it is worth 120 bps more than its
  cost (fees included), or 150 bps less (stop), or after 480 batches (8 hours)
  held, whichever fires first.
- **Otherwise** — hold cash. No shorts, no leverage, at most one open
  position, at most one order per batch.

A full-size round trip pays about 37 bps in fees, slippage and price impact at
this pool's depth, so the 120 bps gain target clears the round-trip cost about
three times over, and the 150 bps stop caps a failed dip at roughly one good
win. All arithmetic is integer math on the bars the harness sends; no clock,
no network, no randomness, no files — two runs on the same data answer alike.

## Files

- `main.ts` — the bot (Node 22, standard library only, via the shim).
- `vendor/makefun-bars.ts` — byte-identical copy of the kit's
  `sdk/makefun-bars.ts` protocol shim.
- `LICENSE` — MIT.

## Local dev grade (kit `grade-local`, process driver)

Run from the kit directory:

```sh
node cli/makefun.mjs grade-local --kit . --bot <this directory> --driver process
```

Result on the frozen dev window (2026-11-16 06:03 UTC → 2026-11-17 06:03 UTC,
1,440 bars): **net PnL +$24.29** (return +2.43%), 5 trades (3 round trips;
the third position is flattened at the window end), max drawdown 0.72%,
fees $2.44, net PnL at 2x fees +$21.84. Dev gate
(net PnL > $0) passed with margin; guardrails met. The same entry was graded
twice by the kit and reproduced byte for byte (see `run-notes.md`).

Reference for the design: the previous race's dev top 5 (dig20 +$126,
anyonecalldark +$93.10, azkas +$88.30, goodluck94 +$80.90, keqing-wangy
+$77.30) were all few-trade dip-buy / mean-reversion bots on a crash-and-
rebound window. This window is calmer (2.49% total range, buy-and-hold
+$1.07), so the design was re-derived from this window's own bars with a
grid search over dip / gain / stop / hold / bounce parameters, and the
parameters were picked from a flat plateau (dip 60–80 bps, gain 100–150 bps
all positive), not from a single peak.

---

<sub>Entered on [make.fun](https://make.fun/?ref=412nc4jk&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
