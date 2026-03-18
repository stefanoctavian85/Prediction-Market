import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth.middleware";
import { handleUsersBets, getUserInformation, generateApiKey } from "./handlers/profile.handlers";

export const profileRoutes = new Elysia({ prefix: "/api/profile" })
    .use(authMiddleware)
    .get("/:id/bets", handleUsersBets, {
        params: t.Object({
            id: t.Numeric(),
        }),
        query: t.Object({
            status: t.Optional(t.String()),
            pageLimit: t.Optional(t.Numeric()),
            page: t.Optional(t.Numeric()),
        }),
    })
    .get("/user/:id", getUserInformation, {
        params: t.Object({
            id: t.Numeric(),
        }),
    })
    .get("/user/generateApiKey/:id", generateApiKey, {
        params: t.Object({
            id: t.Numeric(),
        })
    });
