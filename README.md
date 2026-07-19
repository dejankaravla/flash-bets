FlashBets
Football micro-predictions powered by TxLINE.

FlashBets is a football micro-prediction platform that allows users to predict what will happen during the next five minutes of a football match.
Users authenticate by signing a message with their Solana wallet, receive demo FlashPoints, and place Yes/No predictions on Goal and Corner markets. As the match progresses, markets automatically lock, settle, and generate permanent settlement receipts.
For the hackathon, FlashBets includes a deterministic Replay Mode that demonstrates the complete prediction lifecycle using recorded TxLINE-normalized events, allowing judges to experience the full product even when live matches are unavailable.
Wallets are used only for authentication. FlashPoints have no monetary value and no blockchain transaction is created during gameplay.

Features
⚽ Five-minute Goal and Corner prediction markets
🔐 Solana wallet authentication (identity only)
🎮 Replay Mode for deterministic demonstrations
📡 Live Mode powered by TxLINE
💰 FlashPoints virtual balance
⚙️ Automatic server-side settlement
📄 Permanent settlement receipts
🗂 Prediction history
🧩 Standalone MongoDB support
📱 Responsive mobile-first interface
How it works
TxLINE
│
▼
Fixture & Match Events
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
Settlement Worker
│
▼
Settlement Receipt
Replay Mode replaces only the event source.
The prediction engine, settlement logic, FlashPoints accounting and receipts remain exactly the same.
Technology Stack
Next.js
React
TypeScript
MongoDB
Mongoose
Server-Sent Events (SSE)
Solana Wallet Adapter
TxLINE API
TxLINE Integration
FlashBets uses TxLINE as its primary sports data source.
The application consumes:
Endpoint Purpose
GET /api/fixtures/snapshot Load available football fixtures
GET /api/scores/snapshot/{fixtureId} Initialize fixture state
GET /api/scores/stream Live football events via Server-Sent Events

Replay Mode replays recorded TxLINE-normalized events through the exact same market generation, prediction and settlement pipeline used by Live Mode.
Quick Start
Requirements
Node.js
MongoDB
Installation
git clone <repo>

cd flash-bets

npm install
Environment
Copy:
.env.example
to
.env.local
Example:
FLASHBETS_MODE=REPLAY

MONGODB_URI=mongodb://localhost:27017/flashbets
Run
npm run dev
Open
http://localhost:3000
Demo Flow
Connect a Solana wallet
Sign the authentication message
Receive 1000 FlashPoints
Select a Replay fixture
Place a Goal or Corner prediction
Start Replay (10× recommended)
Wait for automatic settlement
View the generated receipt
Verification
npx tsc --noEmit

npm run lint

npm run build

npm run test:standalone

npm run test:replay

npm run smoke:settlement
Project Structure
app/
components/
lib/
replays/
scripts/
tests/
Documentation
File Description
ARCHITECTURE.md System architecture
ENVIRONMENT.md Environment variables
JUDGE_WALKTHROUGH.md Demo walkthrough
MOBILE_POLISH_CHECKPOINT.md Mobile polish summary
FINAL_RELEASE_CHECKPOINT.md Final release audit

License
Hackathon prototype built for the TxLINE World Cup Hackathon 2026.
