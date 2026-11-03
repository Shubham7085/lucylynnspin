# Lucy Lynn – Lucky Spin & Win Website (`lucy-lynn` Firebase Project)

Connected directly to your existing **Lucy Lynn** Firebase project (`projectId: "lucy-lynn"`).

---

## 1. Isolated Firestore Collections (Zero Conflict with Existing Customer Details Website)

All Lucky Spin records are stored strictly in these 5 separate Firestore collections so your existing Customer Details Website collections are never modified, deleted, or disturbed:

1. **`spinCodes/{code}`**: Unique 1-time access codes (`LL-XXXX-XXXX`) pre-linked to the admin-selected reward (`assignedRewardId`, `assignedRewardName`, `status: "unused" | "used"`, `createdAt`, `customerName`, `spinTimestamp`, `claimStatus`).
2. **`spinCustomers/{customerId}`**: Append-only customer records created upon spin completion.
3. **`spinOffers/{offerId}`**: Active wheel reward slices (`$5 Free Play`, `$10 Free Play`, `10% Bonus`, `20% Bonus`, `$15 Free Play`, `$25 Free Play`).
4. **`spinHistory/{historyId}`**: Immutable spin history log with server timestamps.
5. **`spinSettings/config`**: Global Lucky Spin configuration.

---

## 2. Same Admin Login (`/admin`)

- **Customer Website (`/`)**: Contains **zero** admin login links, icons, or buttons.
- **Hidden Admin Route (`/admin`)**: Opening `https://your-domain.vercel.app/admin` displays the Firebase Authentication login screen.
- **Existing Admin Account**: Sign in using the **exact same Admin Email & Password** that you already use on your Lucy Lynn Customer Details Website.

---

## 3. Deployment Instructions (Vercel & Firebase)

### Step A: Update Firestore Rules (Ensure `spinCodes`, `spinCustomers`, `spinOffers`, `spinHistory`, `spinSettings` are permitted)
In your [Firebase Console → lucy-lynn → Firestore Database → Rules](https://console.firebase.google.com/project/lucy-lynn/firestore/rules), add the collection rules from `firestore.rules` inside your existing `match /databases/{database}/documents` block so both your existing Customer Details Website collections and the new `spin*` collections work side-by-side.

### Step B: Deploy to Vercel
1. Upload or push this folder to a GitHub repository, or deploy directly with the Vercel CLI:
   ```bash
   npx vercel --prod
   ```
2. If deploying via the Vercel Dashboard:
   - Set **Output Directory** to `public` (or deploy the root with `vercel.json` included).
   - `vercel.json` automatically rewrites `/admin` to `/index.html` so visiting `/admin` or refreshing `/admin` always loads the Hidden Admin Dashboard cleanly.
