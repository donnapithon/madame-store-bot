import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey(), // Telegram ID
  username: text("username"),
  balance: real("balance").default(0),
  blocked: integer("blocked", { mode: "boolean" }).default(false),
  blockedUntil: integer("blocked_until", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id").references(() => categories.id),
  name: text("name").notNull(),
  price: real("price").notNull(),
  description: text("description"),
});

export const stock = sqliteTable("stock", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").references(() => products.id),
  content: text("content").notNull(), // The access data
  isSold: integer("is_sold", { mode: "boolean" }).default(false),
  soldTo: integer("sold_to").references(() => users.id),
  soldAt: integer("sold_at", { mode: "timestamp" }),
});

export const gifts = sqliteTable("gifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  value: real("value").notNull(),
  isRedeemed: integer("is_redeemed", { mode: "boolean" }).default(false),
  redeemedBy: integer("redeemed_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  amount: real("amount").notNull(),
  mpPaymentId: text("mp_payment_id").unique(),
  status: text("status").default("pending"), // pending, approved, cancelled
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON or string value
});

// Zod Schemas
export const insertUserSchema = createInsertSchema(users);
export const insertProductSchema = createInsertSchema(products);
export const insertStockSchema = createInsertSchema(stock);
export const insertGiftSchema = createInsertSchema(gifts);

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Stock = typeof stock.$inferSelect;
