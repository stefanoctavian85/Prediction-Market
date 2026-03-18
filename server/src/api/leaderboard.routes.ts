import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth.middleware";
import { handleLeaderboardUsers } from "./handlers/leaderboard.handlers";

export const leaderboardRoutes = new Elysia({ prefix: "/api/leaderboard" })
    .use(authMiddleware)
    .get("/", handleLeaderboardUsers);
