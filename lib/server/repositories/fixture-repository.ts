import "server-only";

import type { ClientSession } from "mongoose";

import type { Fixture } from "@/lib/domain/flash-bets";
import { connectMongo } from "@/lib/server/db/mongoose";
import { FixtureModel } from "@/lib/server/db/models";
import { toDomain } from "@/lib/server/repositories/repository-utils";

export async function findFixture(
  fixtureId: string,
  session?: ClientSession,
): Promise<Fixture | null> {
  await connectMongo();
  const fixture = await FixtureModel.findOne({ fixtureId }).session(session ?? null).lean();
  return fixture ? toDomain<Fixture>(fixture) : null;
}

export async function upsertFixture(
  fixture: Fixture,
  session?: ClientSession,
): Promise<Fixture> {
  await connectMongo();
  const saved = await FixtureModel.findOneAndUpdate(
    { fixtureId: fixture.fixtureId },
    { $set: fixture },
    { upsert: true, new: true, session, lean: true },
  );
  return toDomain<Fixture>(saved);
}

export async function listCompletedFixtures(
  sourceMode: NonNullable<Fixture["sourceMode"]>,
  session?: ClientSession,
): Promise<Fixture[]> {
  await connectMongo();
  const fixtures = await FixtureModel.find({ sourceMode, phase: "FINISHED" })
    .sort({ updatedAt: -1 })
    .session(session ?? null)
    .lean();
  return fixtures.map((fixture) => toDomain<Fixture>(fixture));
}
