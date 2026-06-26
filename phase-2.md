### Context & Objective

Phase 1 is successfully completed. We have a robust, single-source-of-truth Server-Sent Events (SSE) stream running at `/api/stream`.
We are now entering Phase 2: Building the high-fidelity, mobile-first **Live Match Arena UI**.
**Important Path Rule:** There is NO `src/` directory. Create all files directly under the root `app/` and `components/` folders.

### Detailed Task Instructions

1. **Page Creation & Layout (`app/match/[id]/page.tsx`):**
   - Create a fully responsive, dark-themed layout heavily optimized for mobile viewports (mobile-first layout).
   - Establish a native browser `EventSource("/api/stream")` connection inside a React `useEffect` to capture `TxLineStreamMessage` envelopes (both "scores" and "odds" types).

2. **Top Section (Sticky Live Header):**
   - Implement a sticky top-bar displaying active teams (Brazil vs Argentina), the real-time running score, and a pulsing/flashing red "LIVE" badge.
   - Display the current match phase (e.g., "1st Half") and the match minute. Ensure this header stays locked at the top during scrolling.

3. **Dynamic Micro-Markets Generation Logic:**
   - Write a client-side utility function that inspects the incoming `matchMinute` from the SSE stream and dynamically derives three rolling 5-minute prediction windows (e.g., if `matchMinute` is 32, generate windows for 35'-40', 40'-45', and 45'-50').
   - **Lockout Mechanism:** For each generated window, calculate a precise Lockout timestamp (exactly 30 seconds prior to the start of that window, e.g., 34:30).
   - To prevent jittery UI jumps, spin up a local 1-second interval timer on the frontend that smoothly counts down the remaining seconds until Lockout, synchronizing its baseline whenever a fresh server tick arrives.
   - Once the local countdown hits 0, gracefully transition the card into a disabled "LOCKOUT / IN-PROGRESS" state.

4. **Card Mechanics & Simulated Pool Balances:**
   - Render these rolling windows as vertical cards.
   - Each card must display an open proposition (e.g., "Total Corners > 1.5").
   - Include a smooth real-time progress bar visualizing the USDC Pool Allocation split between "YES" and "NO".
   - _Simulated Activity:_ Compute the ratio using a deterministic formula driven by the incoming message sequence number (`seq`). As `seq` increments from the stream, smoothly transition the bar widths to simulate real-time global volume shifting.

5. **Prediction Bottom-Sheet Modal:**
   - When a user clicks any active, non-locked prediction card, slide up a clean mobile-style bottom-sheet modal overlay.
   - Inside the modal, present explicit high-contrast selection buttons for "YES" and "NO".
   - Include a controlled numeric input for the user's USDC allocation amount.
   - Add a prominent action button labeled "Confirm Prediction via Wallet". When clicked, trigger a simulated 1.5-second loading state ("Signing transaction..."), then fire a success toast/notification, close the sheet, and resume the live view.

Ensure proper cleanup by closing the EventSource listener and clearing all local timers when the component unmounts. Verify the layout compiles cleanly with no TypeScript warnings.
