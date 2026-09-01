# MegaBlock Modes Integration

## Overview

MegaBlock supports three production game modes with a common 3% house edge
and a target RTP of 97%.

| Mode | Maximum floors | Crash outcomes | Final multiplier |
|---|---:|---:|---:|
| Easy | 24 | 25 | 24.250000x |
| Medium | 18 | 19 | 18.430000x |
| Hard | 14 | 15 | 14.549999x |

The extra crash outcome represents completing every playable floor safely.
For example, Easy has crash outcomes 1 through 25. A crash floor of 25 means
all 24 floors are safe.

## Backend Configuration

The same difficulty configuration is maintained in the user and admin
backends:

```js
export const MEGA_BLOCK_DIFFICULTY_CONFIG = {
  easy: { maxFloor: 24 },
  medium: { maxFloor: 18 },
  hard: { maxFloor: 14 },
  hardcore: { maxFloor: 15 }
}
```

The `original_games` database row must use:

```text
game_key  = mega-block
house_edge = 3
is_active = true
```

PostgreSQL enforces the mode/floor relationship through
`mega_block_bets_difficulty_floor_check`. The forward migration is:

```text
20260827100000-update-mega-block-difficulty-floors.js
```

## Probability Model

Let:

```text
N = maximum floors for the selected mode
F = completed floor
R = 0.97 target RTP
```

### Conditional Probability

The chance of completing floor `F` after reaching floor `F - 1` is:

```text
P(F | reached F-1) = (N + 1 - F) / (N + 2 - F)
```

### Cumulative Probability

The chance of reaching floor `F` from the beginning is:

```text
C(F) = (N + 1 - F) / (N + 1)
```

### Multiplier

```text
Fair multiplier = 1 / C(F)
Game multiplier = R / C(F)
```

Production floors the multiplier to six decimal places:

```js
Math.floor(gameMultiplier * 1_000_000) / 1_000_000
```

Therefore, some displayed mathematical RTP values are `96.9999%` instead of
exactly `97.0000%`.

## Easy Mode Table

Easy uses `N = 24` and 25 equally likely crash outcomes.

| Floor | Conditional probability | Cumulative probability | Multiplier |
|---:|---:|---:|---:|
| 1 | 96.0000% | 96.0000% | 1.010416x |
| 2 | 95.8333% | 92.0000% | 1.054347x |
| 3 | 95.6522% | 88.0000% | 1.102272x |
| 4 | 95.4545% | 84.0000% | 1.154761x |
| 5 | 95.2381% | 80.0000% | 1.212500x |
| 6 | 95.0000% | 76.0000% | 1.276315x |
| 7 | 94.7368% | 72.0000% | 1.347222x |
| 8 | 94.4444% | 68.0000% | 1.426470x |
| 9 | 94.1176% | 64.0000% | 1.515625x |
| 10 | 93.7500% | 60.0000% | 1.616666x |
| 11 | 93.3333% | 56.0000% | 1.732142x |
| 12 | 92.8571% | 52.0000% | 1.865384x |
| 13 | 92.3077% | 48.0000% | 2.020833x |
| 14 | 91.6667% | 44.0000% | 2.204545x |
| 15 | 90.9091% | 40.0000% | 2.425000x |
| 16 | 90.0000% | 36.0000% | 2.694444x |
| 17 | 88.8889% | 32.0000% | 3.031250x |
| 18 | 87.5000% | 28.0000% | 3.464285x |
| 19 | 85.7143% | 24.0000% | 4.041666x |
| 20 | 83.3333% | 20.0000% | 4.850000x |
| 21 | 80.0000% | 16.0000% | 6.062500x |
| 22 | 75.0000% | 12.0000% | 8.083333x |
| 23 | 66.6667% | 8.0000% | 12.125000x |
| 24 | 50.0000% | 4.0000% | 24.250000x |

## Medium Mode Table

Medium uses `N = 18` and 19 equally likely crash outcomes.

| Floor | Conditional probability | Cumulative probability | Multiplier |
|---:|---:|---:|---:|
| 1 | 94.7368% | 94.7368% | 1.023888x |
| 2 | 94.4444% | 89.4737% | 1.084117x |
| 3 | 94.1176% | 84.2105% | 1.151875x |
| 4 | 93.7500% | 78.9474% | 1.228666x |
| 5 | 93.3333% | 73.6842% | 1.316428x |
| 6 | 92.8571% | 68.4211% | 1.417692x |
| 7 | 92.3077% | 63.1579% | 1.535833x |
| 8 | 91.6667% | 57.8947% | 1.675454x |
| 9 | 90.9091% | 52.6316% | 1.843000x |
| 10 | 90.0000% | 47.3684% | 2.047777x |
| 11 | 88.8889% | 42.1053% | 2.303750x |
| 12 | 87.5000% | 36.8421% | 2.632857x |
| 13 | 85.7143% | 31.5789% | 3.071666x |
| 14 | 83.3333% | 26.3158% | 3.686000x |
| 15 | 80.0000% | 21.0526% | 4.607500x |
| 16 | 75.0000% | 15.7895% | 6.143333x |
| 17 | 66.6667% | 10.5263% | 9.215000x |
| 18 | 50.0000% | 5.2632% | 18.430000x |

## Hard Mode Table

Hard uses `N = 14` and 15 equally likely crash outcomes.

| Floor | Conditional probability | Cumulative probability | Multiplier |
|---:|---:|---:|---:|
| 1 | 93.3333% | 93.3333% | 1.039285x |
| 2 | 92.8571% | 86.6667% | 1.119230x |
| 3 | 92.3077% | 80.0000% | 1.212500x |
| 4 | 91.6667% | 73.3333% | 1.322727x |
| 5 | 90.9091% | 66.6667% | 1.455000x |
| 6 | 90.0000% | 60.0000% | 1.616666x |
| 7 | 88.8889% | 53.3333% | 1.818749x |
| 8 | 87.5000% | 46.6667% | 2.078571x |
| 9 | 85.7143% | 40.0000% | 2.425000x |
| 10 | 83.3333% | 33.3333% | 2.910000x |
| 11 | 80.0000% | 26.6667% | 3.637499x |
| 12 | 75.0000% | 20.0000% | 4.850000x |
| 13 | 66.6667% | 13.3333% | 7.274999x |
| 14 | 50.0000% | 6.6667% | 14.549999x |

## API Integration

### Launch

```http
POST /api/v1/original-games/launch
Content-Type: application/json
```

```json
{
  "casinoSessionId": "a1-mock-megablock-sc",
  "device": "DESKTOP",
  "gameKey": "mega-block",
  "lang": "en"
}
```

Authenticated MegaBlock requests use:

```http
Authorization: AccessToken=<launch-token>
```

### Settings

```http
GET /api/v1/original-games/mega-block/settings
```

The relevant response is:

```json
{
  "data": {
    "minBet": 0.1,
    "maxBet": 100,
    "maxProfit": 1000,
    "defaultDifficulty": "easy",
    "difficulties": {
      "easy": { "maxFloor": 24 },
      "medium": { "maxFloor": 18 },
      "hard": { "maxFloor": 14 },
      "hardcore": { "maxFloor": 15 }
    }
  },
  "errors": []
}
```

### Place Bet

```http
POST /api/v1/original-games/mega-block/place-bet
Content-Type: application/json
```

Easy request:

```json
{
  "amount": 1,
  "difficulty": "easy",
  "clientSeed": "easy-client-seed"
}
```

Medium request:

```json
{
  "amount": 1,
  "difficulty": "medium",
  "clientSeed": "medium-client-seed"
}
```

Hard request:

```json
{
  "amount": 1,
  "difficulty": "hard",
  "clientSeed": "hard-client-seed"
}
```

The response returns the selected difficulty and corresponding `maxFloor`.
The hidden `crashFloor` is never returned while the round is open.

### Unfinished Bet

```http
GET /api/v1/original-games/mega-block/unfinished-bet
```

A player must resolve an unfinished MegaBlock bet before placing another one.

### Drop Block

```http
POST /api/v1/original-games/mega-block/drop-block
Content-Type: application/json
```

```json
{
  "betId": "123"
}
```

The response contains the completed floor count, maximum floor, current
multiplier, and result. A `null` result means the round remains open.

### Cash Out

```http
POST /api/v1/original-games/mega-block/cash-out
Content-Type: application/json
```

```json
{
  "betId": "123"
}
```

Cash-out is available only after completing at least one floor.

### History

```http
GET /api/v1/original-games/mega-block/bets?page=1&perPage=20
GET /api/v1/original-games/mega-block/bets/:betId
```

## RTP Simulator

The simulator is located at:

```text
/home/developer/trueigtech-proj/script/megaBlockRtpSimulation.mjs
```

Select a mode at the top of the script:

```js
const MODE_TO_SIMULATE = 'medium' // easy, medium, hard, or all
```

Run it with:

```bash
cd /home/developer/trueigtech-proj/script
node megaBlockRtpSimulation.mjs
```

For each floor, the simulator displays wins, losses, actual and expected win
rates, conditional odds, multiplier, amount wagered, amount returned, player
profit/loss, house profit/loss, simulated RTP, and mathematical RTP.

## Verified API Flow

The following flow has been tested successfully against a freshly migrated
and seeded database for Easy, Medium, and Hard:

1. Launch the game and obtain an access token.
2. Load settings.
3. Confirm no unfinished bet exists.
4. Place a bet with the selected difficulty.
5. Confirm the unfinished bet is returned.
6. Drop the first block.
7. Cash out after a safe result.
8. Fetch the resolved bet by ID.
9. Fetch paginated bet history.
10. Confirm no unfinished bet remains.

The verified first-floor multipliers are:

| Mode | First-floor multiplier |
|---|---:|
| Easy | 1.010416x |
| Medium | 1.023888x |
| Hard | 1.039285x |
