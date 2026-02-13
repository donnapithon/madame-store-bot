import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { startBot, getBotInstance } from "./bot";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  const isProduction = process.env.NODE_ENV === 'production';
  const deployDomain = process.env.REPLIT_DEPLOYMENT_URL || process.env.REPLIT_DOMAINS;

  if (isProduction && deployDomain) {
    const domain = deployDomain.replace(/^https?:\/\//, '');
    startBot(domain).catch(console.error);

    const bot = getBotInstance();
    app.post('/api/telegram-webhook', (req, res) => {
      bot.handleUpdate(req.body, res).catch((err: any) => {
        console.error('Webhook handling error:', err);
        res.status(500).send('Error');
      });
    });
  } else {
    startBot().catch(console.error);
  }

  app.get(api.health.check.path, (req, res) => {
    res.json({ status: "ok" });
  });

  app.post('/api/webhook/vizzionpay', async (req, res) => {
    const { event, transaction } = req.body;

    if (event === 'TRANSACTION_PAID' && transaction?.status === 'COMPLETED') {
      try {
        const transactionId = transaction.id;
        const localPayment = await storage.getPaymentByMpId(transactionId);

        if (localPayment && localPayment.status !== 'approved') {
          await storage.updatePaymentStatus(localPayment.id, 'approved');

          const bonusPct = parseInt(await storage.getSetting('pix_bonus') || '100');
          let finalAmount = localPayment.amount;
          if (localPayment.amount >= 20) {
            finalAmount += (localPayment.amount * bonusPct) / 100;
          }

          await storage.updateUserBalance(localPayment.userId, finalAmount);

          try {
            const bot = getBotInstance();
            await bot.telegram.sendMessage(
              localPayment.userId,
              `✅ PAGAMENTO APROVADO!\n\n💰 Valor creditado: R$ ${finalAmount.toFixed(2)}\nBônus aplicado: ${localPayment.amount >= 20 ? bonusPct : 0}%`
            );
          } catch (e) {}

          console.log(`VizzionPay: Payment ${transactionId} approved. Added ${finalAmount} to user ${localPayment.userId}`);
        }
      } catch (e) {
        console.error('VizzionPay webhook error:', e);
      }
    }

    res.status(200).send('OK');
  });

  return httpServer;
}
