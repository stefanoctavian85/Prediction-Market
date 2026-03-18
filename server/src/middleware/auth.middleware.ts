import { Elysia } from "elysia";
import { getUserById, verifyPassword } from "../lib/auth";
import db from "../db";
import { usersTable } from "../db/schema";
import { isNotNull } from "drizzle-orm";

export const authMiddleware = new Elysia({ name: "auth-middleware" })
  .derive(async ({ headers, jwt }) => {
    const authHeader = headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { user: null };
    }

    const token = authHeader.substring(7);
    const payload = await jwt.verify(token);
    if (payload) {
      const user = await getUserById(payload.userId);
      return { user };
    }

    const allUsers = await db
      .select()
      .from(usersTable)
      .where(isNotNull(usersTable.apiKey));
    
    for (const user of allUsers) {
      if (await verifyPassword(token, user.apiKey)) {
        return { user };
      }
    }

  })
  .as("plugin");
