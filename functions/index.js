/**
 * Lucy Lynn – Lucky Spin & Win Website
 * Connected to Existing Firebase Project: "lucy-lynn"
 *
 * Uses strictly separate Firestore collections so existing Customer Details Website
 * data is never modified or disturbed:
 * - spinCustomers
 * - spinCodes
 * - spinOffers
 * - spinHistory
 * - spinSettings
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

/**
 * Verify caller is signed in with an authorized non-anonymous Admin account
 * from the existing Lucy Lynn Firebase Authentication project.
 */
async function assertAdmin(auth) {
  if (!auth || !auth.uid || auth.token?.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("unauthenticated", "Authorized Lucy Lynn admin login required.");
  }
  return {
    uid: auth.uid,
    email: auth.token?.email || "admin"
  };
}

/**
 * 1. ADMIN: Generate 1 Unique Code Pre-Linked to Selected Reward in `spinCodes`
 */
exports.generateSpinCode = onCall({ cors: true }, async (request) => {
  const adminUser = await assertAdmin(request.auth);
  const offerId = String(request.data?.offerId || "").trim();
  const offerName = String(request.data?.offerName || "").trim();

  if (!offerId || !offerName) {
    throw new HttpsError("invalid-argument", "Reward selection is required.");
  }

  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  let exists = true;

  while (exists) {
    const bytes = crypto.randomBytes(8);
    let p1 = "";
    let p2 = "";
    for (let i = 0; i < 4; i++) {
      p1 += alphabet[bytes[i] % alphabet.length];
      p2 += alphabet[bytes[i + 4] % alphabet.length];
    }
    code = `LL-${p1}-${p2}`;
    const snap = await db.collection("spinCodes").doc(code).get();
    exists = snap.exists;
  }

  // Strictly create new document without overwriting any existing record
  await db.collection("spinCodes").doc(code).create({
    code,
    assignedRewardId: offerId,
    assignedRewardName: offerName,
    status: "unused",
    createdAt: FieldValue.serverTimestamp(),
    createdBy: adminUser.email,
    customerName: null,
    spinTimestamp: null,
    claimStatus: "not_ready"
  });

  return {
    success: true,
    code,
    assignedRewardId: offerId,
    assignedRewardName: offerName
  };
});

/**
 * 2. CUSTOMER: Verify Access Code in `spinCodes` Before Opening Spin Wheel
 */
exports.verifySpinCode = onCall({ cors: true }, async (request) => {
  const customerName = String(request.data?.customerName || "").trim();
  const accessCode = String(request.data?.accessCode || "").trim().toUpperCase();

  if (!customerName || customerName.length < 2) {
    throw new HttpsError("invalid-argument", "Please enter your valid name.");
  }
  if (!accessCode || accessCode.length < 4) {
    throw new HttpsError("invalid-argument", "Please enter a valid access code.");
  }

  const snap = await db.collection("spinCodes").doc(accessCode).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Invalid access code. Please check and try again.");
  }

  const data = snap.data();
  if (data.status === "used") {
    throw new HttpsError("already-exists", "This access code has already been used and cannot be reused.");
  }

  return {
    status: "ready_to_spin",
    code: data.code,
    customerName,
    assignedRewardId: data.assignedRewardId,
    assignedRewardName: data.assignedRewardName
  };
});

/**
 * 3. CUSTOMER: Execute Atomic Spin & Record in `spinCodes`, `spinCustomers`, and `spinHistory`
 */
exports.completeSpinAndRecord = onCall({ cors: true }, async (request) => {
  const customerName = String(request.data?.customerName || "").trim();
  const accessCode = String(request.data?.accessCode || "").trim().toUpperCase();

  if (!customerName || !accessCode) {
    throw new HttpsError("invalid-argument", "Customer name and access code are required.");
  }

  return await db.runTransaction(async (tx) => {
    const codeRef = db.collection("spinCodes").doc(accessCode);
    const codeSnap = await tx.get(codeRef);

    if (!codeSnap.exists) {
      throw new HttpsError("not-found", "Access code not found.");
    }

    const codeData = codeSnap.data();
    if (codeData.status === "used") {
      throw new HttpsError("already-exists", "This access code has already been used.");
    }

    const customerRef = db.collection("spinCustomers").doc();
    const historyRef = db.collection("spinHistory").doc();

    // 1. Mark code as used in spinCodes
    tx.update(codeRef, {
      status: "used",
      customerName,
      customerId: customerRef.id,
      spinTimestamp: FieldValue.serverTimestamp(),
      claimStatus: "claim_pending"
    });

    // 2. Append new customer spin record in spinCustomers
    tx.create(customerRef, {
      customerName,
      accessCode,
      assignedRewardId: codeData.assignedRewardId,
      assignedRewardName: codeData.assignedRewardName,
      registrationTimestamp: FieldValue.serverTimestamp(),
      spinTimestamp: FieldValue.serverTimestamp(),
      spinStatus: "spin_completed",
      claimStatus: "claim_pending"
    });

    // 3. Append immutable spin history record in spinHistory
    tx.create(historyRef, {
      customerId: customerRef.id,
      customerName,
      accessCode,
      rewardId: codeData.assignedRewardId,
      rewardName: codeData.assignedRewardName,
      spinTimestamp: FieldValue.serverTimestamp(),
      claimStatus: "claim_pending"
    });

    return {
      success: true,
      customerId: customerRef.id,
      historyId: historyRef.id,
      accessCode,
      customerName,
      assignedRewardId: codeData.assignedRewardId,
      assignedRewardName: codeData.assignedRewardName
    };
  });
});
