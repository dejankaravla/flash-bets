# FlashBets Judge Walkthrough

## Before presenting

- Start standalone MongoDB.
- Set `FLASHBETS_MODE=REPLAY` and a valid `MONGODB_URI` in `.env.local`.
- Run `npm run dev` and open `http://localhost:3000`.
- Have a Solana wallet available. It is used only to sign an identity message;
  no transaction is created, signed, or submitted.

## Five-minute presentation

1. **Explain the product (20 seconds).** On the landing page, point to the
   five-step flow: wallet identity, 1,000 demo FlashPoints, five-minute Yes/No
   prediction, automatic settlement, and permanent receipt.
2. **Authenticate (30 seconds).** Connect the wallet and sign in. Show that the
   wallet and available FlashPoints stay visible in the app header. State that
   FlashPoints have no monetary value and cannot be purchased or withdrawn.
3. **Choose historical data (20 seconds).** Open **Matches**, keep the **Replay**
   filter selected, and choose a fixture. Point out the persistent Replay label;
   the product does not represent the recording as a current live match.
4. **Place a prediction (45 seconds).** Open an available Goal or Corner market.
   Show the five-minute window, Yes/No choice, stake, available balance, and
   balance-after-lock preview. Submit and show the accepted/locked state.
5. **Run the replay (90 seconds).** Select **10x**, press **Play**, and point out
   the current replay time, progress, market lock, active window, correction
   delay, and automatic settlement. No browser settlement button is involved.
6. **Prove the result (45 seconds).** Open **My Predictions**, filter to the
   result if useful, and expand the receipt. Show fixture, market/window,
   selection, winning side, goal/corner delta, stake, reward or refund,
   settlement timestamp, receipt ID, and version.
   Return to **Matches** and open **Finished** to show that the completed replay
   run remains in durable history while the Replay tab still offers datasets.
7. **Optional resilience demonstration (30 seconds).** Press **Restart** and
   show the confirmation explaining that unfinished predictions are voided and
   refunded. Cancel unless a clean replay reset is required.

## Expected recovery behavior

- If the replay fixture list is unavailable, use the dashboard retry control
  and confirm MongoDB plus `FLASHBETS_MODE=REPLAY`.
- If a match stream provides no first frame, the match page exits its skeleton
  after ten seconds and offers **Retry** and **Choose another match**.
- If wallet authentication expires, the UI requests a new signed identity
  message instead of showing an HTTP or database error.
- If a run finishes, use **Restart replay** or **Choose another match** from the
  completion panel.

## Accuracy notes

FlashPoints have no monetary value. Do not describe the packaged replay files as
independently verified historical captures or state that Live Mode is verified
without valid TxLINE credentials and an observed live fixture. FlashBets is a
judge-ready replay prototype.
