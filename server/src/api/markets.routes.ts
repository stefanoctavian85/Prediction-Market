import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth.middleware";
import { handleCreateMarket, handleListMarkets, handleGetMarket, handlePlaceBet, handleSetResultMarket, handleArchiveMarket, handleViewOutcomes } from "./handlers/market.handlers";

export const marketRoutes = new Elysia({ prefix: "/api/markets" })
  .use(authMiddleware)
  .get("/", handleListMarkets, {
    query: t.Object({
      status: t.Optional(t.String()),
      sortField: t.Optional(t.String()),
      sortOrder: t.Optional(t.String()),
      pageLimit: t.Optional(t.Numeric()),
      page: t.Optional(t.Numeric())
    }),
  })
  .get("/:id", handleGetMarket, {
    params: t.Object({
      id: t.Numeric(),
    }),
  })
  .get("/outcomes/:marketId", handleViewOutcomes, {
    params: t.Object({
      marketId: t.Numeric()
    })
  })
  .guard(
    {
      beforeHandle({ user, set }) {
        if (!user) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
      },
    },
    (app) =>
      app
        .post("/", handleCreateMarket, {
          body: t.Object({
            title: t.String(),
            description: t.Optional(t.String()),
            outcomes: t.Array(t.String()),
          }),
        })
        .post("/:id/bets", handlePlaceBet, {
          params: t.Object({
            id: t.Numeric(),
          }),
          body: t.Object({
            outcomeId: t.Number(),
            amount: t.Number(),
          }),
        })
  )
  .guard(
    {
      beforeHandle({ user, set }) {
        if (!user || user?.role !== "admin") {
          set.status = 401;
          return { error: "Unauthorized" };
        }
      },
    },
    (app) =>
      app
        .patch("/resolve/:marketId/:outcomeId", handleSetResultMarket, {
          params: t.Object({
            marketId: t.Numeric(),
            outcomeId: t.Numeric(),
          })
        })
        .patch("/archive/:marketId", handleArchiveMarket, {
          params: t.Object({
            marketId: t.Numeric(),
          })
        })
  );
