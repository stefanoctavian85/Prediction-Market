import { eq, and, sql, inArray, asc, desc, isNull } from "drizzle-orm";
import db from "../../db";
import { usersTable, marketsTable, marketOutcomesTable, betsTable } from "../../db/schema";
import {
  validateMarketCreation,
  validateBet,
} from "../../lib/validation";
import { broadcast } from "../../plugins/server-side-events";
import { calculateUserWinnings } from "../../lib/odds";

export async function handleCreateMarket({
  body,
  set,
  user,
}: {
  body: { title: string; description?: string; outcomes: string[] };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const { title, description, outcomes } = body;
  const errors = validateMarketCreation(title, description || "", outcomes);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const market = await db
    .insert(marketsTable)
    .values({
      title,
      description: description || null,
      createdBy: user.id,
    })
    .returning();

  const outcomeIds = await db
    .insert(marketOutcomesTable)
    .values(
      outcomes.map((title: string, index: number) => ({
        marketId: market[0].id,
        title,
        position: index,
      })),
    )
    .returning();

  broadcast({ type: "market_created" });

  set.status = 201;
  return {
    id: market[0].id,
    title: market[0].title,
    description: market[0].description,
    status: market[0].status,
    outcomes: outcomeIds,
  };
}

export async function handleListMarkets({ query }: { query: { status?: string, sortField?: string, sortOrder?: string, pageLimit?: number, page?: number } }) {
  const statusFilter = query.status || "active";
  const sortField = query.sortField || "createdAt";
  const sortOrder = query.sortOrder || "asc";
  const pageLimit = query.pageLimit || 20;
  const page = query.page || 1;
  const offset = (page - 1) * pageLimit;
  const orderDirection = sortOrder === "asc" ? "ASC" : "DESC";

  const sortColumns = {
    createdAt: sortOrder === "asc" ? asc(marketsTable.createdAt) : desc(marketsTable.createdAt),
    totalMarketBets: sql`COALESCE(SUM(${betsTable.amount}), 0) ${sql.raw(orderDirection)}`,
    participants: sql`COALESCE(COUNT(DISTINCT ${betsTable.userId}), 0) ${sql.raw(orderDirection)}`,
  }[sortField] ?? (sortOrder === "asc" ? asc(marketsTable.createdAt) : desc(marketsTable.createdAt));

  const markets = await db
    .select({
      id: marketsTable.id,
      title: marketsTable.title,
      status: marketsTable.status,
      createdAt: marketsTable.createdAt,
      creator: usersTable.username,
      totalMarketBets: sql<number>`COALESCE(SUM(${betsTable.amount}), 0)`,
      participants: sql<number>`COALESCE(COUNT(DISTINCT ${betsTable.userId}), 0)`
    })
    .from(marketsTable)
    .leftJoin(usersTable, eq(marketsTable.createdBy, usersTable.id))
    .leftJoin(betsTable, eq(betsTable.marketId, marketsTable.id))
    .where(eq(marketsTable.status, statusFilter))
    .groupBy(marketsTable.id)
    .orderBy(sortColumns)
    .limit(pageLimit)
    .offset(offset);

  const marketsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(marketsTable)
    .where(eq(marketsTable.status, statusFilter));

  const marketIds = markets.map((market) => market.id);

  const outcomes = await db
    .select()
    .from(marketOutcomesTable)
    .where(inArray(marketOutcomesTable.marketId, marketIds))
    .orderBy(asc(marketOutcomesTable.position));

  const betsByOutcome = await db
    .select({
      outcomeId: betsTable.outcomeId,
      totalBetSize: sql<number>`COALESCE(SUM(${betsTable.amount}), 0)`
    })
    .from(betsTable)
    .where(inArray(betsTable.outcomeId, outcomes.map((outcome) => outcome.id)))
    .groupBy(betsTable.outcomeId);

  const betsByOutcomeMap = new Map(betsByOutcome.map((bet) => [bet.outcomeId, bet.totalBetSize]));
  const outcomesByMarket = new Map<number, typeof outcomes>();
  for (const outcome of outcomes) {
    if (!outcomesByMarket.has(outcome.marketId)) outcomesByMarket.set(outcome.marketId, []);
    outcomesByMarket.get(outcome.marketId)!.push(outcome);
  }

  const enrichedMarkets = markets.map((market) => ({
    id: market.id,
    title: market.title,
    status: market.status,
    creator: market?.creator,
    createdAt: market.createdAt,
    totalMarketBets: market.totalMarketBets,
    participants: market.participants,
    outcomes: (outcomesByMarket.get(market.id) ?? []).map((outcome) => {
      const outcomeBets = betsByOutcomeMap.get(outcome.id) ?? 0;
      const odds = market.totalMarketBets > 0 ? Number(((outcomeBets / market.totalMarketBets) * 100).toFixed(2)) : 0;
      return { id: outcome.id, title: outcome.title, odds, totalBets: outcomeBets };
    }),
  }));

  return {
    markets: enrichedMarkets,
    totalMarkets: marketsCount[0]?.count || 0,
  };
}

export async function handleGetMarket({
  params,
  set,
}: {
  params: { id: number };
  set: { status: number };
}) {
  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, params.id),
    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes, { asc }) => asc(outcomes.position),
      },
    },
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  const betsPerOutcome = await Promise.all(
    market.outcomes.map(async (outcome) => {
      const totalBets = await db
        .select()
        .from(betsTable)
        .where(eq(betsTable.outcomeId, outcome.id));

      const totalAmount = totalBets.reduce((sum, bet) => sum + bet.amount, 0);
      return { outcomeId: outcome.id, totalBets: totalAmount };
    }),
  );

  const totalMarketBets = betsPerOutcome.reduce((sum, b) => sum + b.totalBets, 0);

  return {
    id: market.id,
    title: market.title,
    description: market.description,
    status: market.status,
    creator: market.creator?.username,
    outcomes: market.outcomes.map((outcome) => {
      const outcomeBets = betsPerOutcome.find((b) => b.outcomeId === outcome.id)?.totalBets || 0;
      const odds =
        totalMarketBets > 0 ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2)) : 0;

      return {
        id: outcome.id,
        title: outcome.title,
        odds,
        totalBets: outcomeBets,
      };
    }),
    totalMarketBets,
  };
}

export async function handlePlaceBet({
  params,
  body,
  set,
  user,
}: {
  params: { id: number };
  body: { outcomeId: number; amount: number };
  set: { status: number };
  user: typeof usersTable.$inferSelect;
}) {
  const marketId = params.id;
  const { outcomeId, amount } = body;
  const errors = validateBet(amount, user.balance);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, marketId),
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  if (market.status !== "active") {
    set.status = 400;
    return { error: "Market is not active" };
  }

  const outcome = await db.query.marketOutcomesTable.findFirst({
    where: and(eq(marketOutcomesTable.id, outcomeId), eq(marketOutcomesTable.marketId, marketId)),
  });

  if (!outcome) {
    set.status = 404;
    return { error: "Outcome not found" };
  }

  let bet: typeof betsTable.$inferSelect[] = [];

  await db.transaction(async (tx) => {
    bet = await tx
      .insert(betsTable)
      .values({
        userId: user.id,
        marketId,
        outcomeId,
        amount: Number(amount),
      })
      .returning();

    const newBalance = user.balance - amount;
    await tx
      .update(usersTable)
      .set({ balance: newBalance })
      .where(eq(usersTable.id, user.id));
  });

  broadcast({ type: "bet_placed", marketId });

  set.status = 201;
  return {
    id: bet[0]?.id,
    userId: bet[0]?.userId,
    marketId: bet[0]?.marketId,
    outcomeId: bet[0]?.outcomeId,
    amount: bet[0]?.amount,
  };
}

export async function handleSetResultMarket({ params, set }: { params: { marketId: number, outcomeId: number }; set: { status: number } }) {
  const marketId = params.marketId;
  const outcomeId = params.outcomeId;

  const market = await db.query.marketsTable.findFirst({
    where: and(
      eq(marketsTable.id, marketId),
      eq(marketsTable.status, "active"),
    )
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  const outcome = await db.query.marketOutcomesTable.findFirst({
    where: and(
      eq(marketOutcomesTable.id, outcomeId),
      eq(marketOutcomesTable.marketId, marketId)
    )
  });

  if (!outcome) {
    set.status = 404;
    return { error: "Outcome not found" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(marketsTable)
      .set({ status: "resolved", resolvedOutcomeId: outcomeId })
      .where(and(eq(marketsTable.id, marketId), eq(marketsTable.status, "active"), isNull(marketsTable.resolvedOutcomeId)));

    const allBets = await tx
      .select({
        totalMarketBets: sql<number>`COALESCE(SUM(${betsTable.amount}), 0)`
      })
      .from(betsTable)
      .where(eq(betsTable.marketId, marketId));

    const totalMarketBets = Number(allBets[0]?.totalMarketBets);

    const winningBets = await tx
      .select({
        totalWinningOutcome: sql<number>`COALESCE(SUM(${betsTable.amount}), 0)`
      })
      .from(betsTable)
      .where(
        and(
          eq(betsTable.marketId, marketId),
          eq(betsTable.outcomeId, outcomeId),
        ));

    const winningOutcomeTotalBets = winningBets[0].totalWinningOutcome;

    const winners = await tx
      .select({
        userId: betsTable.userId,
        totalAmount: sql<number>`COALESCE(SUM(${betsTable.amount}), 0)`
      })
      .from(betsTable)
      .where(
        and(
          eq(betsTable.marketId, marketId),
          eq(betsTable.outcomeId, outcomeId),
        )
      )
      .groupBy(betsTable.userId);

    for (const winner of winners) {
      const winningAmount: number = calculateUserWinnings(winner?.totalAmount, winningOutcomeTotalBets, totalMarketBets);

      await tx
        .update(usersTable)
        .set({ balance: sql<number>`${usersTable.balance} + ${winningAmount}` })
        .where(eq(usersTable.id, winner.userId));
    }
  });

  broadcast({ type: "market_resolved" });

  set.status = 200;
  return {
    success: true,
  };
}

export async function handleArchiveMarket({ params, set }: { params: { marketId: number, outcomeId: number }; set: { status: number } }) {
  const marketId = params.marketId;

  const market = await db.query.marketsTable.findFirst({
    where: and(
      eq(marketsTable.id, marketId),
      eq(marketsTable.status, "active"),
    )
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(marketsTable)
      .set({ status: "archived" })
      .where(and(eq(marketsTable.id, marketId), eq(marketsTable.status, "active"), isNull(marketsTable.resolvedOutcomeId)));

    const users = await tx
      .select({
        userId: betsTable.userId,
        totalAmount: sql<number>`COALESCE(SUM(${betsTable.amount}), 0)`
      })
      .from(betsTable)
      .where(eq(betsTable.marketId, marketId))
      .groupBy(betsTable.userId);

    for (const user of users) {
      await tx
        .update(usersTable)
        .set({ balance: sql<number>`${usersTable.balance} + ${user.totalAmount}`})
        .where(eq(usersTable.id, user.userId));
    }
  });

  broadcast({ type: "market_archived" });

  set.status = 200;
  return {
    success: true,
  };
}

export async function handleViewOutcomes({ params, set }: { params: { marketId: number }; set: { status: number } }) {
  const marketId = params.marketId;

  if (!marketId) {
    set.status = 400;
    return { error: "Invalid market ID" };
  }

  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, marketId)
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  const outcomes = await db
    .select({
      id: marketOutcomesTable.id,
      title: marketOutcomesTable.title,
    })
    .from(marketOutcomesTable)
    .where(eq(marketOutcomesTable.marketId, marketId));

  if (!outcomes) {
    set.status = 404;
    return { error: "Outcomes not found" };
  }

  set.status = 200;
  return {
    title: market.title,
    description: market.description,
    status: market.status,
    createdAt: market.createdAt,
    outcomes,
  };
}