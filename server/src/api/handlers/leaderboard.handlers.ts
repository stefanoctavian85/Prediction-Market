import { eq, and, sql, desc } from "drizzle-orm";
import db from "../../db";
import { usersTable, marketsTable, marketOutcomesTable, betsTable } from "../../db/schema";

export async function handleLeaderboardUsers({ set } : { set: { status: number } }) {
    const users = await db
        .select({
            userId: usersTable.id,
            username: usersTable.username,
            totalWinnings: sql<number>`COALESCE(SUM(${betsTable.amount}), 0)`,
            place: sql<number>`ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(${betsTable.amount}), 0) DESC)`,
        })
        .from(usersTable)
        .innerJoin(betsTable, eq(betsTable.userId, usersTable.id))
        .innerJoin(marketsTable, eq(betsTable.marketId, marketsTable.id))
        .innerJoin(marketOutcomesTable, eq(marketOutcomesTable.id, betsTable.outcomeId))
        .where(
            and(
                eq(marketsTable.resolvedOutcomeId, marketOutcomesTable.id),
                eq(marketsTable.status, "resolved")
            )
        )
        .groupBy(usersTable.id)
        .orderBy(desc(sql<number>`COALESCE(SUM(${betsTable.amount}), 0)`))
        .limit(20);

    set.status = 200;
    return users;
}