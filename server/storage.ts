import { db } from "./db";
import {
  users, products, stock, gifts, payments, categories, settings,
  type User, type Product, type Stock
} from "@shared/schema";
import { eq, and, count, sql, desc, like } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  createUser(user: { id: number; username: string }): Promise<User>;
  updateUserBalance(id: number, amount: number): Promise<void>; // amount can be negative
  
  // Categories
  getCategories(): Promise<any[]>;
  createCategory(name: string): Promise<any>;
  
  // Products
  getProductsByCategory(categoryId: number): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: { categoryId: number; name: string; price: number; description: string }): Promise<Product>;
  
  // Stock
  addStock(stockItems: { productId: number; content: string }[]): Promise<void>;
  getStockCount(productId: number): Promise<number>;
  getNextAvailableStock(productId: number): Promise<Stock | undefined>;
  markStockSold(stockId: number, soldTo: number): Promise<void>;
  
  // Payments
  createPayment(payment: { userId: number; amount: number; mpPaymentId: string }): Promise<any>;
  getPaymentByMpId(mpPaymentId: string): Promise<any>;
  updatePaymentStatus(id: number, status: string): Promise<void>;
  
  // Gifts
  createGift(code: string, value: number): Promise<any>;
  getGift(code: string): Promise<any>;
  redeemGift(id: number, userId: number): Promise<void>;
  
  // Search
  searchAvailableStock(searchTerm: string): Promise<(Stock & { productName: string; productPrice: number })[]>;

  // Settings
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
}

export class SQLiteStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const res = await db.select().from(users).where(eq(users.id, id));
    return res[0];
  }

  async createUser(user: { id: number; username: string }): Promise<User> {
    const res = await db.insert(users).values({
      id: user.id,
      username: user.username,
      balance: 0,
    })
    .onConflictDoUpdate({ target: users.id, set: { username: user.username } })
    .returning();
    return res[0];
  }

  async updateUserBalance(id: number, amount: number): Promise<void> {
    // SQLite doesn't support `increment` helper easily in Drizzle with better-sqlite3 yet in some versions, 
    // but sql template works.
    await db.run(
      sql`UPDATE users SET balance = balance + ${amount} WHERE id = ${id}`
    );
  }

  async getCategories(): Promise<any[]> {
    return db.select().from(categories);
  }
  
  async createCategory(name: string): Promise<any> {
    const res = await db.insert(categories).values({ name }).returning();
    return res[0];
  }

  async getProductsByCategory(categoryId: number): Promise<Product[]> {
    return db.select().from(products).where(eq(products.categoryId, categoryId));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const res = await db.select().from(products).where(eq(products.id, id));
    return res[0];
  }
  
  async createProduct(data: { categoryId: number; name: string; price: number; description: string }): Promise<Product> {
    const res = await db.insert(products).values(data).returning();
    return res[0];
  }

  async addStock(stockItems: { productId: number; content: string }[]): Promise<void> {
    if (stockItems.length === 0) return;
    await db.insert(stock).values(stockItems);
  }

  async getStockCount(productId: number): Promise<number> {
    const res = await db.select({ count: count() })
      .from(stock)
      .where(and(eq(stock.productId, productId), eq(stock.isSold, false)));
    return res[0].count;
  }

  async getNextAvailableStock(productId: number): Promise<Stock | undefined> {
    const res = await db.select()
      .from(stock)
      .where(and(eq(stock.productId, productId), eq(stock.isSold, false)))
      .limit(1);
    return res[0];
  }

  async searchAvailableStock(searchTerm: string): Promise<(Stock & { productName: string; productPrice: number })[]> {
    const res = await db.select({
      id: stock.id,
      productId: stock.productId,
      content: stock.content,
      isSold: stock.isSold,
      soldTo: stock.soldTo,
      soldAt: stock.soldAt,
      productName: products.name,
      productPrice: products.price,
    })
    .from(stock)
    .innerJoin(products, eq(stock.productId, products.id))
    .where(and(eq(stock.isSold, false), sql`LOWER(${stock.content}) LIKE LOWER(${'%' + searchTerm + '%'})`));
    return res as any;
  }

  async markStockSold(stockId: number, soldTo: number): Promise<void> {
    await db.update(stock)
      .set({ isSold: true, soldTo, soldAt: new Date() })
      .where(eq(stock.id, stockId));
  }

  async createPayment(data: { userId: number; amount: number; mpPaymentId: string }): Promise<any> {
    const res = await db.insert(payments).values(data).returning();
    return res[0];
  }

  async getPaymentByMpId(mpPaymentId: string): Promise<any> {
    const res = await db.select().from(payments).where(eq(payments.mpPaymentId, mpPaymentId));
    return res[0];
  }

  async updatePaymentStatus(id: number, status: string): Promise<void> {
    await db.update(payments).set({ status }).where(eq(payments.id, id));
  }

  async createGift(code: string, value: number): Promise<any> {
    const res = await db.insert(gifts).values({ code, value }).returning();
    return res[0];
  }

  async getGift(code: string): Promise<any> {
    const res = await db.select().from(gifts).where(eq(gifts.code, code));
    return res[0];
  }

  async redeemGift(id: number, userId: number): Promise<void> {
    await db.update(gifts)
      .set({ isRedeemed: true, redeemedBy: userId })
      .where(eq(gifts.id, id));
  }

  async getSetting(key: string): Promise<string | undefined> {
    const res = await db.select().from(settings).where(eq(settings.key, key));
    return res[0]?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await db.insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
}

export const storage = new SQLiteStorage();
