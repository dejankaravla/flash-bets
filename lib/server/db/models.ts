import "server-only";

import mongoose, { Schema } from "mongoose";

const snapshotSchema = new Schema(
  {
    goals: { type: Number, required: true, min: 0 },
    corners: { type: Number, required: true, min: 0 },
    sequence: { type: Number, required: true },
    matchSecond: { type: Number, required: true, min: 0 },
    phase: { type: String, required: true },
    sourceTimestamp: { type: String, required: true },
    receivedAt: { type: String, required: true },
    capturedAt: { type: String, required: true },
  },
  { _id: false },
);

const awardSchema = new Schema(
  {
    predictionId: { type: String, required: true },
    wallet: { type: String, required: true },
    side: { type: String, enum: ["YES", "NO"], required: true },
    amount: { type: Number, required: true, min: 1 },
    reward: { type: Number, required: true, min: 0 },
    refund: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["WON", "LOST", "VOID"], required: true },
  },
  { _id: false },
);

const walletAccountSchema = new Schema(
  {
    wallet: { type: String, required: true, unique: true, index: true },
    available: { type: Number, required: true, min: 0 },
    locked: { type: Number, required: true, min: 0 },
    won: { type: Number, required: true, min: 0 },
    lost: { type: Number, required: true, min: 0 },
    refunded: { type: Number, required: true, min: 0 },
    settlementReceiptIds: { type: [String], default: [], select: false },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { collection: "wallet_accounts", versionKey: false },
);

const fixtureSchema = new Schema(
  {
    fixtureId: { type: String, required: true, unique: true, index: true },
    participants: { type: [String], required: true },
    phase: { type: String, required: true },
    matchMinute: { type: Number, required: true, min: 0 },
    matchSecond: { type: Number, required: true, min: 0 },
    goals: { type: Number, default: null, min: 0 },
    corners: { type: Number, default: null, min: 0 },
    sequence: { type: Number, required: true },
    sourceTimestamp: { type: String, required: true },
    sourceTimestampTrusted: { type: Boolean, required: true },
    receivedAt: { type: String, required: true },
    source: { type: String, required: true },
    sourceMode: { type: String, enum: ["LIVE", "REPLAY"], required: true, default: "LIVE", index: true },
    replayId: { type: String, default: null },
    replayRunId: { type: String, default: null },
    complete: { type: Boolean, required: true },
    updatedAt: { type: String, required: true },
  },
  { collection: "fixtures", versionKey: false },
);

const marketSchema = new Schema(
  {
    marketId: { type: String, required: true, unique: true, index: true },
    fixtureId: { type: String, required: true, index: true },
    type: { type: String, enum: ["GOAL", "CORNER"], required: true },
    period: { type: String, enum: ["FIRST_HALF", "SECOND_HALF"], required: true },
    startMinute: { type: Number, required: true, min: 0 },
    endMinute: { type: Number, required: true, min: 0 },
    opensAt: { type: String, required: true },
    locksAt: { type: String, required: true },
    startsAt: { type: String, required: true },
    endsAt: { type: String, required: true },
    settlesAt: { type: String, required: true, index: true },
    settlementDelaySeconds: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["CREATED", "OPEN", "LOCKED", "WAITING_FOR_SETTLEMENT", "SETTLED", "VOID"],
      required: true,
      index: true,
    },
    openingSnapshot: { type: snapshotSchema, default: null },
    closingSnapshot: { type: snapshotSchema, default: null },
    result: { type: String, enum: ["YES", "NO", "VOID", null], default: null },
    settlementReceiptId: { type: String, default: null },
    question: { type: String, required: true },
    source: { type: String, required: true },
    sourceMode: { type: String, enum: ["LIVE", "REPLAY"], required: true, default: "LIVE", index: true },
    replayId: { type: String, default: null },
    replayRunId: { type: String, default: null },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  { collection: "markets", versionKey: false },
);
marketSchema.index({ fixtureId: 1, startMinute: 1, type: 1 });
marketSchema.index({ status: 1, settlesAt: 1 });

const predictionSchema = new Schema(
  {
    predictionId: { type: String, required: true, unique: true, index: true },
    wallet: { type: String, required: true, index: true },
    marketId: { type: String, required: true, index: true },
    side: { type: String, enum: ["YES", "NO"], required: true },
    amount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["PENDING", "LOCKED", "WON", "LOST", "REFUNDED", "VOID"],
      required: true,
      index: true,
    },
    settlementReceiptId: { type: String, default: null },
    reward: { type: Number, required: true, min: 0, default: 0 },
    refund: { type: Number, required: true, min: 0, default: 0 },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
    settledAt: { type: String, default: null },
  },
  { collection: "predictions", versionKey: false },
);
predictionSchema.index({ wallet: 1, marketId: 1 }, { unique: true });

const settlementReceiptSchema = new Schema(
  {
    receiptId: { type: String, required: true, unique: true, index: true },
    marketId: { type: String, required: true, unique: true, index: true },
    fixtureId: { type: String, required: true, index: true },
    settlementReason: { type: String, required: true },
    txLineOpeningTimestamp: { type: String, default: null },
    txLineClosingTimestamp: { type: String, default: null },
    openingSnapshot: { type: snapshotSchema, default: null },
    closingSnapshot: { type: snapshotSchema, default: null },
    calculatedDelta: { type: Number, default: null },
    winningSide: { type: String, enum: ["YES", "NO", null], default: null },
    correctionDelaySeconds: { type: Number, required: true, min: 0 },
    settlementVersion: { type: Number, required: true, min: 1 },
    totalPool: { type: Number, required: true, min: 0 },
    winningPool: { type: Number, required: true, min: 0 },
    remainder: { type: Number, required: true, min: 0 },
    awards: { type: [awardSchema], required: true, default: [] },
    createdAt: { type: String, required: true },
  },
  { collection: "settlement_receipts", versionKey: false },
);

const walletChallengeSchema = new Schema(
  {
    challengeId: { type: String, required: true, unique: true, index: true },
    wallet: { type: String, required: true, index: true },
    message: { type: String, required: true },
    nonce: { type: String, required: true },
    origin: { type: String, required: true },
    createdAt: { type: String, required: true },
    expiresAt: { type: String, required: true },
    usedAt: { type: String, default: null },
  },
  { collection: "wallet_challenges", versionKey: false },
);

const walletSessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    wallet: { type: String, required: true, index: true },
    createdAt: { type: String, required: true },
    expiresAt: { type: String, required: true },
    revokedAt: { type: String, default: null },
  },
  { collection: "wallet_sessions", versionKey: false },
);

export const WalletAccountModel =
  mongoose.models.WalletAccount || mongoose.model("WalletAccount", walletAccountSchema);
export const FixtureModel =
  mongoose.models.Fixture || mongoose.model("Fixture", fixtureSchema);
export const MarketModel = mongoose.models.Market || mongoose.model("Market", marketSchema);
export const PredictionModel =
  mongoose.models.Prediction || mongoose.model("Prediction", predictionSchema);
export const SettlementReceiptModel =
  mongoose.models.SettlementReceipt ||
  mongoose.model("SettlementReceipt", settlementReceiptSchema);
export const WalletChallengeModel =
  mongoose.models.WalletChallenge ||
  mongoose.model("WalletChallenge", walletChallengeSchema);
export const WalletSessionModel =
  mongoose.models.WalletSession || mongoose.model("WalletSession", walletSessionSchema);

export const allFlashBetsModels = [
  WalletAccountModel,
  FixtureModel,
  MarketModel,
  PredictionModel,
  SettlementReceiptModel,
  WalletChallengeModel,
  WalletSessionModel,
];
