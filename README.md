# FlashBets

> **Football micro-predictions powered by TxLINE.**

FlashBets is a football micro-prediction platform that allows users to predict what will happen during the next five minutes of a football match.

Users authenticate by signing a message with their Solana wallet, receive 1,000 demo FlashPoints, and place Yes/No predictions on Goal and Corner markets. As the match progresses, markets automatically lock, settle, and generate permanent settlement receipts.

For the hackathon, FlashBets includes both **Live Mode** and a deterministic **Replay Mode**. Replay Mode allows judges to experience the complete prediction lifecycle using recorded TxLINE-normalized events, even when no live World Cup matches are available.

> **Wallets are used only for authentication. FlashPoints have no monetary value and no blockchain transaction is created during gameplay.**

---

# Features

- ⚽ Five-minute Goal and Corner prediction markets
- 🔐 Solana wallet authentication using signed messages
- 🎮 Replay Mode for deterministic demonstrations
- 📡 Live Mode powered by TxLINE
- 💰 FlashPoints virtual currency
- ⚙️ Automatic server-side settlement
- 📄 Permanent settlement receipts
- 📚 Prediction history
- 🧩 Standalone MongoDB support
- 📱 Responsive mobile-first interface

---

# How FlashBets Works

```text
                 TxLINE
                    │
                    ▼
       Live Feed / Replay Dataset
                    │
                    ▼
          Event Normalization
                    │
                    ▼
          Market Generation
                    │
                    ▼
          Prediction Engine
                    │
                    ▼
               MongoDB
                    │
                    ▼
      Automatic Settlement Worker
                    │
                    ▼
        Settlement Receipts & History
```

Replay Mode replaces only the event source.

The prediction engine, FlashPoints accounting, settlement logic and receipt generation remain identical between Live and Replay modes.

---

# Technology Stack

- Next.js
- React
- TypeScript
- MongoDB
- Mongoose
- Server-Sent Events (SSE)
- Solana Wallet Adapter
- TxLINE API

---

# TxLINE Integration

FlashBets uses TxLINE as its primary football data source.

The application currently consumes the following TxLINE endpoints:

| Endpoint                               | Purpose                                                  |
| -------------------------------------- | -------------------------------------------------------- |
| `GET /api/fixtures/snapshot`           | Load available football fixtures                         |
| `GET /api/scores/snapshot/{fixtureId}` | Initialize fixture state                                 |
| `GET /api/scores/stream`               | Receive live football updates through Server-Sent Events |

Replay Mode replays recorded TxLINE-normalized events through the exact same market generation, prediction, settlement and receipt pipeline used by Live Mode.

---

# Getting Started

## Requirements

- Node.js
- MongoDB

---

## Installation

```bash
git clone <repository-url>

cd flash-bets

npm install
```

---

## Environment Setup

Copy:

```text
.env.example
```

to

```text
.env.local
```

Example configuration:

```text
FLASHBETS_MODE=REPLAY

MONGODB_URI=mongodb://localhost:27017/flashbets
```

---

## Run the Project

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# Demo Flow

1. Connect a Solana wallet.
2. Sign the authentication message.
3. Receive 1,000 FlashPoints.
4. Open **Matches** and choose a Replay fixture.
5. Place a Goal or Corner prediction.
6. Start Replay (10× speed recommended).
7. Watch automatic settlement.
8. View the generated settlement receipt in **My Predictions**.

---

# Verification

Run the following checks:

```bash
npx tsc --noEmit

npm run lint

npm run build

npm run test:standalone

npm run test:replay

npm run smoke:settlement
```

---

# Project Structure

```text
app/            Next.js App Router
components/     React components
lib/            Core business logic
replays/        Replay datasets
scripts/        Utility scripts
tests/          Test suite
```

---

# Documentation

| File                          | Description                 |
| ----------------------------- | --------------------------- |
| `ARCHITECTURE.md`             | Overall system architecture |
| `ENVIRONMENT.md`              | Environment configuration   |
| `JUDGE_WALKTHROUGH.md`        | Demo presentation guide     |
| `FINAL_RELEASE_CHECKPOINT.md` | Final QA and release audit  |

---

# Roadmap

Potential future improvements include:

- Additional prediction market types
- Tournament-wide competitions
- Historical analytics
- Optional trustless on-chain settlement using TxLINE validation primitives

These ideas are outside the scope of the current hackathon MVP.

---

# License

Built for the **TxLINE World Cup Hackathon 2026**.
