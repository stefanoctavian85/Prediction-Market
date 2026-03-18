import { eq, and, sql, inArray, desc } from "drizzle-orm";
import db from "../../db";
import { usersTable, marketsTable, marketOutcomesTable, betsTable } from "../../db/schema";
import { randomBytes } from "crypto";
import { hashPassword } from "../../lib/auth";

export async function handleUsersBets({
    query,
    params,
    set,
}: {
    query: { status?: string, pageLimit?: number, page?: number };
    params: { id: number };
    set: { status: number }
}) {
    const status = query.status || "active";
    const userId = params.id;
    const pageLimit = query.pageLimit || 20;
    const page = query.page || 1;
    const offset = (page - 1) * pageLimit;

    if (!userId || isNaN(userId)) {
        set.status = 400;
        return { error: "Invalid user id" };
    }

    const userBets = await db
        .select({
            id: betsTable.id,
            amount: betsTable.amount,
            marketId: marketsTable.id,
            marketTitle: marketsTable.title,
            status: marketsTable.status,
            resolvedOutcomeId: marketsTable?.resolvedOutcomeId,
            outcomeId: betsTable.outcomeId,
            outcomeTitle: marketOutcomesTable.title,
            createdAt: betsTable.createdAt,
        })
        .from(betsTable)
        .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
        .innerJoin(marketOutcomesTable, eq(betsTable.outcomeId, marketOutcomesTable.id))
        .where(
            and(
                eq(betsTable.userId, userId),
                status ? eq(marketsTable.status, status) : undefined,
            )
        )
        .orderBy(desc(betsTable.createdAt))
        .limit(pageLimit)
        .offset(offset);

    const userBetsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(betsTable)
        .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
        .where(
            and(
                eq(betsTable.userId, userId),
                status ? eq(marketsTable.status, status) : undefined,
            ),
        );

    const marketIds = userBets.map((bet) => bet.marketId);
    const outcomeIds = userBets.map((bet) => bet.outcomeId);

    const betsByOutcome = await db
        .select({
            outcomeId: betsTable.outcomeId,
            totalAmount: sql<number>`COALESCE(SUM(${betsTable.amount}), 0)`
        })
        .from(betsTable)
        .where(inArray(betsTable.outcomeId, outcomeIds))
        .groupBy(betsTable.outcomeId);

    const betsByMarket = await db
        .select({
            marketId: betsTable.marketId,
            totalAmount: sql<number>`COALESCE(SUM(${betsTable.amount}), 0)`
        })
        .from(betsTable)
        .where(inArray(betsTable.marketId, marketIds))
        .groupBy(betsTable.marketId);

    const betsByOutcomeMap = new Map(betsByOutcome.map((bet) => [bet.outcomeId, bet.totalAmount]));
    const betsByMarketMap = new Map(betsByMarket.map((bet) => [bet.marketId, bet.totalAmount]));

    const enrichedBets = userBets.map((bet) => {
        const outcomeBets = betsByOutcomeMap.get(bet.outcomeId) ?? 0;
        const marketBets = betsByMarketMap.get(bet.marketId) ?? 0;
        const odds = marketBets > 0 ? Number(((outcomeBets / marketBets) * 100)) : 0;

        return {
            ...bet,
            userId: userId,
            odds,
            won: (status === "resolved") ? bet.resolvedOutcomeId === bet.outcomeId : false,
        }
    });

    const groupedBets = new Map<string, typeof enrichedBets[0]>();

    for (const bet of enrichedBets) {
        const key = `${bet.marketId}-${bet.outcomeId}`;
        if (groupedBets.has(key)) {
            groupedBets.get(key)!.amount += bet.amount;
        } else {
            groupedBets.set(key, { ...bet });
        }
    }

    return {
        bets: Array.from(groupedBets.values()),
        totalBets: userBetsCount[0]?.count || 0,
    };
}

export async function getUserInformation({ params, set }: { params: { id: number }, set: { status: number } }) {
    const userId = params.id;

    if (!userId) {
        set.status = 400;
        return { error: "Invalid user id" };
    }

    const user = await db.query.usersTable.findFirst({
        where: eq(usersTable.id, userId)
    });

    if (!user) {
        set.status = 404;
        return { error: "User not found" };
    }

    set.status = 200;
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        balance: user.balance,
    };
}

export async function generateApiKey({ params, user, set }: { params: { id: number }, user: typeof usersTable.$inferSelect, set: { status: number }}) {
    const userId = params.id;

    if (!userId || isNaN(userId)) {
        set.status = 400;
        return { error: "Invalid user id" };
    }

    if (userId !== user.id) {
        set.status = 403;
        return { error: "Forbidden" };
    }

    const newApiKey = randomBytes(32).toString("hex");
    const newApiKeyHashed = await hashPassword(newApiKey);

    await db
        .update(usersTable)
        .set({ apiKey: newApiKeyHashed })
        .where(eq(usersTable.id, userId));

    set.status = 200;
    return {
        apiKey: newApiKey,
    }
}