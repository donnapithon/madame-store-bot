import { Telegraf, Markup, Context } from ‘telegraf’; import { storage }
from ‘./storage’; import { createPixPayment, checkPaymentStatus } from
‘./mercadopago’; import { db } from ‘./db’; import { users, products,
stock, categories, payments, settings, gifts } from ‘../shared/schema’;
import { eq, and, count, sum, desc } from ‘drizzle-orm’; import fs from
‘fs’; import path from ‘path’;

const BOT_TOKEN = ‘8326693654:AAEcqomArgiSoHqFpLPT8pCA2Q1BjLMcJA8’;
const ADMIN_ID = 7514490878;

const bot = new Telegraf(BOT_TOKEN); const userStates = new Map<number,
{ step: string; data: any }>();

bot.use(async (ctx, next) => { if (ctx.from) { const user = await
storage.getUser(ctx.from.id); if (!user) { await storage.createUser({
id: ctx.from.id, username: ctx.from.username || ‘unknown’ }); } else if
(ctx.from.id !== ADMIN_ID) { if (user.blocked) { return ctx.reply(‘🚫
Você está banido da loja. Contate o suporte se achar que é um erro.’); }
if (user.blockedUntil) { const until = new Date(user.blockedUntil); if
(until > new Date()) { return
ctx.reply(⏳ Você está suspenso até ${until.toLocaleString('pt-BR')}. Aguarde para voltar a usar a loja.);
} else { await db.update(users).set({ blockedUntil: null
}).where(eq(users.id, ctx.from.id)); } } } } return next(); });

bot.start(async (ctx) => { const customWelcome = await
storage.getSetting(‘welcome_text’); const welcomeText = customWelcome ||
` ❤️💙 BEM VINDOS A MADAME STORE 💙❤️

👥 ENTRE NO GRUPO ➡️ https://t.me/+hnVsYPNNDSkyYTUx

🎁 PROMOÇÃO ATIVA Toda recarga a partir de R$20 recebe 100% de bônus

📜 TERMOS DE USO ❌ Não realizamos estorno ✅ Garantimos saldo 🛡 Sistema
antifraude 📦 Entrega LIVE 🔁 Trocas via PV ⏱️ 10 minutos

📩 Suporte: @madame_store_suporte ⚠️ Se não concorda, NÃO COMPRE. `;

const imagePath = path.join(process.cwd(), ‘client’, ‘public’, ‘images’,
‘welcome.png’); const keyboard = Markup.keyboard([ [‘🛒 PRODUTOS’, ‘💰
RECARREGAR SALDO’], [‘🎁 RESGATAR GIFT’, ‘💳 MEU SALDO’], [‘📜
HISTÓRICO’], ]).resize();

try { if (fs.existsSync(imagePath) && fs.statSync(imagePath).size > 100)
{ await ctx.replyWithPhoto({ source: fs.createReadStream(imagePath) }, {
caption: welcomeText, …keyboard }); } else { await
ctx.reply(welcomeText, keyboard); } } catch (e) { await
ctx.reply(welcomeText, keyboard); } });

bot.command(‘admin’, async (ctx) => { if (ctx.from.id !== ADMIN_ID)
return; await ctx.reply(‘MENU ADMIN’, Markup.keyboard([ [‘➕ ADICIONAR
PRODUTO’, ‘✏️ EDITAR PRODUTO’], [‘📦 ADICIONAR ESTOQUE’, ‘📦 ESTOQUE EM
MASSA’], [‘🧾 EDITAR ESTOQUE’, ‘🏠 EDITAR BOAS-VINDAS’], [‘💰 ALTERAR
MIN PIX’, ‘🎁 ALTERAR BÔNUS PIX’], [‘📂 CATEGORIAS’, ‘👥 CLIENTES’],
[‘📢 TRANSMITIR’, ‘📊 ESTATÍSTICAS’], [‘🎁 GERAR GIFT’, ‘⬅️ VOLTAR’],
]).resize()); });

bot.hears(‘📂 CATEGORIAS’, async (ctx) => { if (ctx.from.id !==
ADMIN_ID) return; await ctx.reply(‘Gestão de Categorias:’,
Markup.inlineKeyboard([ [Markup.button.callback(‘➕ ADICIONAR’,
‘admin_cat_add’)], [Markup.button.callback(‘✏️ EDITAR’,
‘admin_cat_edit’)], [Markup.button.callback(‘❌ EXCLUIR’,
‘admin_cat_del’)], ])); });

const USERS_PER_PAGE = 10;

async function showUserListPage(ctx: any, page: number) { const allUsers
= await db.select().from(users); if (allUsers.length === 0) return
ctx.reply(‘👥 Nenhum cliente cadastrado ainda.’); const totalPages =
Math.ceil(allUsers.length / USERS_PER_PAGE); const currentPage =
Math.max(0, Math.min(page, totalPages - 1)); const pageUsers =
allUsers.slice(currentPage * USERS_PER_PAGE, (currentPage + 1) *
USERS_PER_PAGE);

let text =
👥 CLIENTES (${allUsers.length} total)\nPágina ${currentPage + 1}/${totalPages}\n\n;
pageUsers.forEach((u, i) => { const idx = currentPage * USERS_PER_PAGE +
i + 1; const name = (u.username || ‘sem_nome’).replace(//g, ’\’); text
+= ${idx}. @${name} | R$ ${(u.balance ?? 0).toFixed(2)}\n; });

const userButtons = pageUsers.map((u) => [
Markup.button.callback(@${u.username || 'sem_nome'} - R$${(u.balance ?? 0).toFixed(2)},
admin_user_select_${u.id}), ]);

const navButtons: any[] = []; if (currentPage > 0)
navButtons.push(Markup.button.callback(‘⬅️ Anterior’,
admin_users_page_${currentPage - 1})); if (currentPage < totalPages - 1)
navButtons.push(Markup.button.callback(‘Próximo ➡️’,
admin_users_page_${currentPage + 1})); if (navButtons.length > 0)
userButtons.push(navButtons);

await ctx.reply(text, Markup.inlineKeyboard(userButtons)); }

bot.hears(‘👥 CLIENTES’, async (ctx) => { if (ctx.from.id !== ADMIN_ID)
return; await showUserListPage(ctx, 0); });

bot.action(/^admin_users_page_()$/, async (ctx) => { if (ctx.from!.id
!== ADMIN_ID) return; const page = parseInt(ctx.match[1]); try { await
ctx.deleteMessage(); } catch (e) {} await showUserListPage(ctx, page);
});

bot.action(/^admin_user_select_()$/, async (ctx) => { if (ctx.from!.id
!== ADMIN_ID) return; const targetId = parseInt(ctx.match[1]); const
user = await storage.getUser(targetId); if (!user) return ctx.reply(‘❌
Usuário não encontrado.’); const name = (user.username ||
‘sem_nome’).replace(//g, ’\’); let statusText = ’‘; if (user.blocked) {
statusText =’🚫 Status: BANIDO’; } else if (user.blockedUntil && new
Date(user.blockedUntil) > new Date()) { const until = new
Date(user.blockedUntil); statusText =
\n⏳ Status: SUSPENSO até ${until.toLocaleString('pt-BR')}; } else {
statusText = ‘✅ Status: Ativo’; } await ctx.reply(
👤 Cliente: @${name}\n🆔 ID: ${user.id}\n💰 Saldo: R$ ${(user.balance ?? 0).toFixed(2)}${statusText},
Markup.inlineKeyboard([ [Markup.button.callback(‘💰 ADICIONAR SALDO’,
admin_user_add_${targetId})], [Markup.button.callback(‘✏️ DEFINIR
SALDO’, admin_user_set_${targetId})], [Markup.button.callback(‘❌ ZERAR
SALDO’, admin_user_zero_${targetId})],
[Markup.button.callback(user.blocked ? ‘✅ DESBANIR’ : ‘🚫 BANIR’,
admin_user_ban_${targetId})], [Markup.button.callback(‘⏳ SUSPENDER’,
admin_user_suspend_${targetId})], [Markup.button.callback(‘🗑️ EXCLUIR
CLIENTE’, admin_user_delete_${targetId})], ]) ); });

bot.hears(‘📢 TRANSMITIR’, async (ctx) => { if (ctx.from.id !==
ADMIN_ID) return; await ctx.reply(‘O que deseja transmitir?’,
Markup.inlineKeyboard([ [Markup.button.callback(‘📝 APENAS TEXTO’,
‘admin_broadcast_text’)], [Markup.button.callback(‘🖼️ TEXTO + IMAGEM’,
‘admin_broadcast_photo’)], ])); });

bot.hears(‘📊 ESTATÍSTICAS’, async (ctx) => { if (ctx.from.id !==
ADMIN_ID) return; const totalVendas = await db.select({ val: count()
}).from(stock).where(eq(stock.isSold, true)); const totalRecargas =
await db.select({ val: count(), total: sum(payments.amount)
}).from(payments).where(eq(payments.status, ‘approved’)); const
recargasPendentes = await db.select({ val: count()
}).from(payments).where(eq(payments.status, ‘pending’)); const
recargasCanceladas = await db.select({ val: count()
}).from(payments).where(eq(payments.status, ‘cancelled’));

let stats = 📊 *RELATÓRIO GERAL*\n\n; stats +=
📦 Vendas Concluídas: ${totalVendas[0].val}\n; stats +=
💰 Total Arrecadado: R$ ${Number(totalRecargas[0].total || 0).toFixed(2)}\n;
stats += ✅ Recargas Sucesso: ${totalRecargas[0].val}\n; stats +=
⏳ Recargas Pendentes: ${recargasPendentes[0].val}\n; stats +=
❌ Recargas Abandonadas: ${recargasCanceladas[0].val}\n; await
ctx.reply(stats, { parse_mode: ‘Markdown’ }); });

bot.hears(‘📜 HISTÓRICO’, async (ctx) => { const userId = ctx.from.id;
const history = await db .select({ content: stock.content, soldAt:
stock.soldAt, prodName: products.name }) .from(stock)
.innerJoin(products, eq(stock.productId, products.id))
.where(eq(stock.soldTo, userId)) .orderBy(desc(stock.soldAt))
.limit(20);

if (history.length === 0) return ctx.reply(‘📭 Você ainda não realizou
compras.’);

let text = ‘📜 SUAS ÚLTIMAS 20 COMPRAS:’; history.forEach((h, i) => {
text += ${i + 1}. *${h.prodName}*\n📦 \${h.content}``; }); await
ctx.reply(text, { parse_mode: ‘Markdown’ }); });

bot.hears(‘🏠 EDITAR BOAS-VINDAS’, async (ctx) => { if (ctx.from.id !==
ADMIN_ID) return; await ctx.reply(‘O que deseja editar?’,
Markup.inlineKeyboard([ [Markup.button.callback(‘📝 EDITAR TEXTO’,
‘admin_edit_welcome_text’)], [Markup.button.callback(‘🖼️ EDITAR IMAGEM’,
‘admin_edit_welcome_img’)], ])); });

bot.action(‘admin_edit_welcome_text’, async (ctx) => { if (ctx.from!.id
!== ADMIN_ID) return; userStates.set(ctx.from!.id, { step:
‘edit_welcome_text’, data: {} }); const current = (await
storage.getSetting(‘welcome_text’)) || ‘Padrão’; await
ctx.reply(Texto atual:\n\n${current}\n\nDigite o NOVO texto de boas-vindas:);
});

bot.action(‘admin_edit_welcome_img’, async (ctx) => { if (ctx.from!.id
!== ADMIN_ID) return; userStates.set(ctx.from!.id, { step:
‘edit_welcome_img’, data: {} }); await ctx.reply(‘Envie a NOVA IMAGEM de
boas-vindas:’); });

bot.action(‘admin_cat_add’, async (ctx) => { if (ctx.from!.id !==
ADMIN_ID) return; userStates.set(ctx.from!.id, { step:
‘admin_add_cat_name’, data: {} }); await ctx.reply(‘Digite o NOME da
nova categoria:’); });

bot.action(‘admin_cat_edit’, async (ctx) => { if (ctx.from!.id !==
ADMIN_ID) return; const cats = await storage.getCategories(); const
buttons = cats.map((c: any) => [Markup.button.callback(c.name,
admin_editcat_sel_${c.id})]); await ctx.reply(‘Selecione a categoria
para renomear:’, Markup.inlineKeyboard(buttons)); });

bot.action(/^admin_editcat_sel_()$/, async (ctx) => { const catId =
parseInt(ctx.match[1]); userStates.set(ctx.from!.id, { step:
‘admin_edit_cat_name’, data: { catId } }); await ctx.reply(‘Digite o
NOVO NOME para esta categoria:’); });

bot.action(‘admin_cat_del’, async (ctx) => { if (ctx.from!.id !==
ADMIN_ID) return; const cats = await storage.getCategories(); const
buttons = cats.map((c: any) => [Markup.button.callback(c.name,
admin_delcat_confirm_${c.id})]); await ctx.reply(‘Selecione a categoria
para EXCLUIR:’, Markup.inlineKeyboard(buttons)); });

bot.action(/^admin_delcat_confirm_()$/, async (ctx) => { const catId =
parseInt(ctx.match[1]); const prods = await
storage.getProductsByCategory(catId); for (const p of prods) { await
db.delete(stock).where(eq(stock.productId, p.id)); await
db.delete(products).where(eq(products.id, p.id)); } await
db.delete(categories).where(eq(categories.id, catId)); await
ctx.reply(‘✅ Categoria e todos os seus produtos excluídos!’); });

bot.action(‘admin_broadcast_text’, async (ctx) => {
userStates.set(ctx.from!.id, { step: ‘admin_broadcast_text_msg’, data:
{} }); await ctx.reply(‘Digite a mensagem de texto para enviar a
TODOS:’); });

bot.action(‘admin_broadcast_photo’, async (ctx) => {
userStates.set(ctx.from!.id, { step: ‘admin_broadcast_photo_msg’, data:
{} }); await ctx.reply(‘Digite o TEXTO que acompanhará a imagem:’); });

bot.hears(‘📦 ESTOQUE EM MASSA’, async (ctx) => { if (ctx.from.id !==
ADMIN_ID) return; const cats = await storage.getCategories(); const
buttons = cats.map((c: any) => [Markup.button.callback(c.name,
admin_bulkstock_cat_${c.id})]); await ctx.reply(‘Selecione a categoria
para estoque em massa:’, Markup.inlineKeyboard(buttons)); });

bot.action(/^admin_bulkstock_cat_()$/, async (ctx) => {  if (ctx.from!.id !== ADMIN_ID) return;  const catId = parseInt(ctx.match[1]);  const prods = await storage.getProductsByCategory(catId);  const buttons = prods.map((p) => [Markup.button.callback(p.name, `admin_bulkstock_prod_${p.id}`)]);
await ctx.reply(‘Selecione o produto para estoque em massa:’,
Markup.inlineKeyboard(buttons)); });

bot.action(/^admin_bulkstock_prod_()$/, async (ctx) => { if
(ctx.from!.id !== ADMIN_ID) return; const prodId =
parseInt(ctx.match[1]); userStates.set(ctx.from!.id, { step:
‘add_bulk_stock’, data: { productId: prodId } }); await ctx.reply(‘📂
Envie o arquivo .txt com o estoque em massa (use == para separar cada
item).’); });

bot.hears(‘➕ ADICIONAR PRODUTO’, async (ctx) => { if (ctx.from.id !==
ADMIN_ID) return; const cats = await storage.getCategories(); const
buttons = cats.map((c: any) => [Markup.button.callback(c.name,
admin_addprod_cat_${c.id})]); await ctx.reply(‘Selecione a categoria do
novo produto:’, Markup.inlineKeyboard(buttons)); });

bot.hears(‘✏️ EDITAR PRODUTO’, async (ctx) => { if (ctx.from.id !==
ADMIN_ID) return; const cats = await storage.getCategories(); const
buttons = cats.map((c: any) => [Markup.button.callback(c.name,
admin_editprod_cat_${c.id})]); await ctx.reply(‘Selecione a categoria
para editar produtos:’, Markup.inlineKeyboard(buttons)); });

bot.action(/^admin_editprod_cat_()$/, async (ctx) => {  if (ctx.from!.id !== ADMIN_ID) return;  const catId = parseInt(ctx.match[1]);  const prods = await storage.getProductsByCategory(catId);  if (prods.length === 0) return ctx.reply('Nenhum produto nesta categoria.');  const buttons = prods.map((p) => [Markup.button.callback(p.name, `admin_editprod_select_${p.id}`)]);
await ctx.reply(‘Selecione o produto para editar:’,
Markup.inlineKeyboard(buttons)); });

bot.action(/^admin_editprod_select_()$/, async (ctx) => { if
(ctx.from!.id !== ADMIN_ID) return; const prodId =
parseInt(ctx.match[1]); const prod = await storage.getProduct(prodId);
if (!prod) return ctx.reply(‘Produto não encontrado.’); await
ctx.reply(Produto: ${prod.name}\nPreço: R$ ${prod.price}\n\nO que deseja fazer?,
Markup.inlineKeyboard([ [Markup.button.callback(‘📝 EDITAR DADOS’,
admin_editprod_data_${prodId})], [Markup.button.callback(‘❌ EXCLUIR
PRODUTO’, admin_delprod_${prodId})], ])); });

bot.action(/^admin_editprod_data_()$/, async (ctx) => { const prodId =
parseInt(ctx.match[1]); userStates.set(ctx.from!.id, { step:
‘edit_prod_name’, data: { productId: prodId } }); await
ctx.reply(‘Digite o NOVO NOME (ou “.” para manter):’); });

bot.action(/^admin_delprod_()$/, async (ctx) => { if (ctx.from!.id !==
ADMIN_ID) return; const prodId = parseInt(ctx.match[1]); await
db.delete(stock).where(eq(stock.productId, prodId)); await
db.delete(products).where(eq(products.id, prodId)); await ctx.reply(‘✅
Produto e seu estoque excluídos com sucesso!’); });

bot.hears(‘📊 HISTÓRICO GERAL’, async (ctx) => { if (ctx.from.id !==
ADMIN_ID) return; const cats = await storage.getCategories(); let stats
= ‘📊 ESTOQUE GERAL’; for (const cat of cats) { const prods = await
storage.getProductsByCategory(cat.id); stats += 📁 *${cat.name}*\n; for
(const p of prods) { const c = await storage.getStockCount(p.id); stats
+= - ${p.name}: ${c} un\n; } stats += ‘’; } await ctx.reply(stats, {
parse_mode: ‘Markdown’ }); });

bot.hears(‘💰 ALTERAR MIN PIX’, async (ctx) => { if (ctx.from.id !==
ADMIN_ID) return; const currentMin = (await
storage.getSetting(‘min_pix’)) || ‘1.00’; userStates.set(ctx.from.id, {
step: ‘set_min_pix’, data: {} }); await
ctx.reply(Valor mínimo atual: R$ ${currentMin}\nDigite o NOVO valor mínimo:);
});

bot.hears(‘🎁 ALTERAR BÔNUS PIX’, async (ctx) => { if (ctx.from.id !==
ADMIN_ID) return; const currentBonus = (await
storage.getSetting(‘pix_bonus’)) || ‘100’; userStates.set(ctx.from.id, {
step: ‘set_pix_bonus’, data: {} }); await
ctx.reply(Bônus atual: ${currentBonus}%\nDigite o NOVO bônus (%):); });

bot.hears(‘🎁 GERAR GIFT’, async (ctx) => { if (ctx.from.id !==
ADMIN_ID) return; userStates.set(ctx.from.id, { step: ‘gen_gift_value’,
data: {} }); await ctx.reply(‘Digite o VALOR do Gift:’); });

bot.action(/^admin_addprod_cat_()$/, async (ctx) => { if (ctx.from!.id
!== ADMIN_ID) return; const catId = parseInt(ctx.match[1]);
userStates.set(ctx.from!.id, { step: ‘add_prod_name’, data: {
categoryId: catId } }); await ctx.reply(‘Digite o NOME do produto:’);
});

bot.hears(‘🧾 EDITAR ESTOQUE’, async (ctx) => { if (ctx.from.id !==
ADMIN_ID) return; const cats = await storage.getCategories(); const
buttons = cats.map((c: any) => [Markup.button.callback(c.name,
admin_editstock_cat_${c.id})]); await ctx.reply(‘Selecione a categoria
para editar estoque:’, Markup.inlineKeyboard(buttons)); });

bot.action(/^admin_editstock_cat_()$/, async (ctx) => {  if (ctx.from!.id !== ADMIN_ID) return;  const catId = parseInt(ctx.match[1]);  const prods = await storage.getProductsByCategory(catId);  if (prods.length === 0) return ctx.reply('Nenhum produto nesta categoria.');  const buttons = prods.map((p) => [Markup.button.callback(p.name, `admin_editstock_prod_${p.id}`)]);
await ctx.reply(‘Selecione o produto:’, Markup.inlineKeyboard(buttons));
});

bot.action(/^admin_editstock_prod_()$/, async (ctx) => { if
(ctx.from!.id !== ADMIN_ID) return; const prodId =
parseInt(ctx.match[1]); const items = await
db.select().from(stock).where(and(eq(stock.productId, prodId),
eq(stock.isSold, false))).limit(10); if (items.length === 0) return
ctx.reply(‘Sem estoque disponível para este produto.’); const buttons =
items.map((item) =>
[Markup.button.callback(Remover: ${item.content.substring(0, 20)}...,
admin_rmstock_${item.id})]); await ctx.reply(‘Selecione um item para
REMOVER:’, Markup.inlineKeyboard(buttons)); });

bot.action(/^admin_rmstock_()$/, async (ctx) => { if (ctx.from!.id !==
ADMIN_ID) return; const stockId = parseInt(ctx.match[1]); await
db.delete(stock).where(eq(stock.id, stockId)); await ctx.reply(‘✅ Item
de estoque removido!’); });

bot.action(/^admin_user_add_()$/, async (ctx) => { if (ctx.from!.id !==
ADMIN_ID) return; const targetId = parseInt(ctx.match[1]);
userStates.set(ctx.from!.id, { step: ‘admin_add_user_bal’, data: {
targetId } }); await ctx.reply(‘Digite o VALOR a adicionar ao saldo do
cliente:’); });

bot.action(/^admin_user_set_()$/, async (ctx) => { if (ctx.from!.id !==
ADMIN_ID) return; const targetId = parseInt(ctx.match[1]);
userStates.set(ctx.from!.id, { step: ‘admin_set_user_bal’, data: {
targetId } }); await ctx.reply(‘Digite o NOVO SALDO para o cliente:’);
});

bot.action(/^admin_user_zero_()$/, async (ctx) => { if (ctx.from!.id !==
ADMIN_ID) return; const targetId = parseInt(ctx.match[1]); await
db.update(users).set({ balance: 0 }).where(eq(users.id, targetId));
await ctx.reply(‘✅ Saldo zerado silenciosamente! O cliente NÃO foi
notificado.’); });

bot.action(/^admin_user_ban_()$/, async (ctx) => { if (ctx.from!.id !==
ADMIN_ID) return; const targetId = parseInt(ctx.match[1]); const user =
await storage.getUser(targetId); if (!user) return ctx.reply(‘❌ Usuário
não encontrado.’); const newBlocked = !user.blocked; await
db.update(users).set({ blocked: newBlocked, blockedUntil: null
}).where(eq(users.id, targetId)); if (newBlocked) { await ctx.reply(‘🚫
Cliente BANIDO permanentemente!’); try { await
bot.telegram.sendMessage(targetId, ‘🚫 Você foi banido da loja. Contate
o suporte se achar que é um erro.’); } catch (e) {} } else { await
ctx.reply(‘✅ Cliente DESBANIDO com sucesso!’); try { await
bot.telegram.sendMessage(targetId, ‘✅ Você foi desbanido! Pode voltar a
usar a loja normalmente.’); } catch (e) {} } });

bot.action(/^admin_user_suspend_()$/, async (ctx) => { if (ctx.from!.id
!== ADMIN_ID) return; const targetId = parseInt(ctx.match[1]);
userStates.set(ctx.from!.id, { step: ‘admin_suspend_user’, data: {
targetId } }); await ctx.reply( ‘Digite o tempo de suspensão::• 30m = 30
minutos• 2h = 2 horas• 1d = 1 dia• 7d = 7 dias’ ); });

bot.action(/^admin_user_delete_()$/, async (ctx) => {  if (ctx.from!.id !== ADMIN_ID) return;  const targetId = parseInt(ctx.match[1]);  const user = await storage.getUser(targetId);  if (!user) return ctx.reply('❌ Usuário não encontrado.');  await ctx.reply(  `⚠️ TEM CERTEZA que deseja EXCLUIR o cliente @${(user.username
|| ‘sem_nome’)}?vai remover o cliente e todo o histórico dele. Essa ação
NÃO pode ser
desfeita!,     Markup.inlineKeyboard([       [Markup.button.callback('✅ SIM, EXCLUIR',admin_user_confirm_delete_${targetId}`)],
[Markup.button.callback(‘❌ CANCELAR’, ‘admin_user_cancel_delete’)], ])
); });

bot.action(/^admin_user_confirm_delete_()$/, async (ctx) => { if
(ctx.from!.id !== ADMIN_ID) return; const targetId =
parseInt(ctx.match[1]); try { await db.update(stock).set({ soldTo: null,
isSold: false }).where(eq(stock.soldTo, targetId)); await
db.update(gifts).set({ redeemedBy: null, isRedeemed: false
}).where(eq(gifts.redeemedBy, targetId)); await
db.delete(payments).where(eq(payments.userId, targetId)); await
db.delete(users).where(eq(users.id, targetId)); await ctx.reply(‘🗑️
Cliente excluído com sucesso!’); } catch (err) { console.error(‘Erro ao
excluir cliente:’, err); await ctx.reply(‘❌ Erro ao excluir cliente.
Tente novamente.’); } });

bot.action(‘admin_user_cancel_delete’, async (ctx) => { await
ctx.reply(‘❌ Exclusão cancelada.’); });

bot.on(‘photo’, async (ctx) => { const userId = ctx.from.id; const state
= userStates.get(userId);

if (state && state.step === ‘admin_broadcast_photo_img’ && userId ===
ADMIN_ID) { const allUsers = await db.select().from(users); const photo
= ctx.message.photo[ctx.message.photo.length - 1].file_id;
userStates.delete(userId); await
ctx.reply(📢 Transmitindo para ${allUsers.length} usuários...); let cnt
= 0; for (const u of allUsers) { try { await
ctx.telegram.sendPhoto(u.id, photo, { caption: state.data.text });
cnt++; } catch (e) {} } await
ctx.reply(✅ Transmissão concluída! ${cnt} receberam.); return; }

if (state && state.step === ‘edit_welcome_img’ && userId === ADMIN_ID) {
try { const photo = ctx.message.photo[ctx.message.photo.length - 1];
const file = await ctx.telegram.getFile(photo.file_id); const link =
https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}; const
imagePath = path.join(process.cwd(), ‘client’, ‘public’, ‘images’,
‘welcome.png’); const dir = path.dirname(imagePath); if
(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); const
response = await fetch(link); const buffer = await
response.arrayBuffer(); fs.writeFileSync(imagePath,
Buffer.from(buffer)); userStates.delete(userId); await ctx.reply(‘✅
Imagem de boas-vindas atualizada!’); } catch (e) { await ctx.reply(‘❌
Erro ao processar imagem.’); } } });

bot.on(‘text’, async (ctx, next) => { const userId = ctx.from.id; const
state = userStates.get(userId); const text = ctx.message.text.trim();

if (text === ‘⬅️ VOLTAR’ || text === ‘/start’) {
userStates.delete(userId); return next(); }

if (state) { if (state.step === ‘recharge_amount’) { const amount =
parseFloat(text.replace(‘,’, ‘.’)); if (isNaN(amount) || amount <= 0)
return ctx.reply(‘Valor inválido. Digite novamente:’); const minPix =
parseFloat((await storage.getSetting(‘min_pix’)) || ‘1.00’); if (amount
< minPix) return ctx.reply(❌ Mínimo: R$ ${minPix.toFixed(2)}.);
userStates.delete(userId);

      await ctx.reply('🔄 Gerando PIX...');
      try {
        const result = await createPixPayment(amount, `Recarga User ${userId}`, userId);
        const transactionId = result.transactionId;
        const pixCode = result.pix?.code;
        const pixBase64 = result.pix?.base64;

        if (!transactionId || !pixCode) {
          await ctx.reply('❌ Erro ao gerar PIX. Tente novamente.');
          return;
        }

        await storage.createPayment({ userId, amount, mpPaymentId: transactionId });
        await ctx.reply('✅ PIX Gerado! Copie o código abaixo:');
        const qrMsg = await ctx.reply(`\`${pixCode}\``, { parse_mode: 'Markdown' });

        let qrPhotoMsg: any = null;
        if (pixBase64) {
          try {
            const b64Data = pixBase64.replace(/^data:image\/\w+;base64,/, '');
            qrPhotoMsg = await ctx.replyWithPhoto({ source: Buffer.from(b64Data, 'base64') });
          } catch (e) {}
        }

        const waitMsg = await ctx.reply('⏳ Aguardando pagamento... Crédito automático em até 10 min.');

        let attempts = 0;
        const checkInt = setInterval(async () => {
          attempts++;
          try {
            const status = await checkPaymentStatus(transactionId);
            if (status === 'approved') {
              clearInterval(checkInt);
              const existing = await storage.getPaymentByMpId(transactionId);
              if (existing && existing.status === 'pending') {
                await storage.updatePaymentStatus(existing.id, 'approved');
                const bonusPercent = parseInt((await storage.getSetting('pix_bonus')) || '0');
                const bonus = (amount * bonusPercent) / 100;
                await storage.updateUserBalance(userId, amount + bonus);

                try {
                  await ctx.deleteMessage(waitMsg.message_id);
                  await ctx.deleteMessage(qrMsg.message_id);
                  if (qrPhotoMsg) await ctx.deleteMessage(qrPhotoMsg.message_id);
                } catch (e) {}

                await ctx.reply(
                  `✅ PAGAMENTO APROVADO!\n\n💰 Valor: R$ ${amount.toFixed(2)}\n🎁 Bônus: R$ ${bonus.toFixed(2)}\n💳 Total Creditado: R$ ${(amount + bonus).toFixed(2)}\n\nSaldo creditado com sucesso!`
                );
              }
            }

            if (attempts >= 60) {
              clearInterval(checkInt);
              const existing = await storage.getPaymentByMpId(transactionId);
              if (existing && existing.status === 'pending') {
                await storage.updatePaymentStatus(existing.id, 'cancelled');
                try {
                  await ctx.deleteMessage(waitMsg.message_id);
                  await ctx.deleteMessage(qrMsg.message_id);
                  if (qrPhotoMsg) await ctx.deleteMessage(qrPhotoMsg.message_id);
                } catch (e) {}
                await ctx.reply('❌ O tempo para pagamento expirou e o código foi cancelado.');
              }
            }
          } catch (e) {}
        }, 10000);
      } catch (e) {
        console.error('PIX generation error:', e);
        await ctx.reply('❌ Erro ao gerar PIX. Tente novamente.');
      }
      return;
    }

    if (state.step === 'admin_add_cat_name') {
      await storage.createCategory(text);
      userStates.delete(userId);
      await ctx.reply(`✅ Categoria "${text}" criada!`);
      return;
    }

    if (state.step === 'admin_edit_cat_name') {
      await db.update(categories).set({ name: text }).where(eq(categories.id, state.data.catId));
      userStates.delete(userId);
      await ctx.reply('✅ Nome da categoria atualizado!');
      return;
    }

    if (state.step === 'admin_add_user_bal') {
      const addAmount = parseFloat(text.replace(',', '.'));
      if (isNaN(addAmount) || addAmount <= 0) return ctx.reply('Valor inválido. Digite um valor positivo:');
      await storage.updateUserBalance(state.data.targetId, addAmount);
      userStates.delete(userId);
      await ctx.reply(`✅ R$ ${addAmount.toFixed(2)} adicionados ao saldo do cliente!`);
      try {
        const updatedUser = await storage.getUser(state.data.targetId);
        await bot.telegram.sendMessage(
          state.data.targetId,
          `💰 SALDO ADICIONADO!\n\nO administrador adicionou R$ ${addAmount.toFixed(2)} ao seu saldo.\n💳 Saldo atual: R$ ${(updatedUser?.balance ?? 0).toFixed(2)}`
        );
      } catch (e) {}
      return;
    }

    if (state.step === 'admin_set_user_bal') {
      const newBal = parseFloat(text.replace(',', '.'));
      if (isNaN(newBal) || newBal < 0) return ctx.reply('Valor inválido. Digite um valor válido:');
      await db.update(users).set({ balance: newBal }).where(eq(users.id, state.data.targetId));
      userStates.delete(userId);
      await ctx.reply(`✅ Saldo definido para R$ ${newBal.toFixed(2)}!`);
      return;
    }

    if (state.step === 'admin_suspend_user') {
      const match = text.match(/^(\d+)(m|h|d)$/i);
      if (!match) return ctx.reply('Formato inválido. Use: 30m, 2h, 1d, 7d');
      const amount = parseInt(match[1]);
      if (amount <= 0) return ctx.reply('O tempo deve ser maior que zero.');
      const unit = match[2].toLowerCase();
      let ms = 0;
      if (unit === 'm') ms = amount * 60 * 1000;
      else if (unit === 'h') ms = amount * 60 * 60 * 1000;
      else if (unit === 'd') ms = amount * 24 * 60 * 60 * 1000;
      const until = new Date(Date.now() + ms);
      await db.update(users).set({ blockedUntil: until, blocked: false }).where(eq(users.id, state.data.targetId));
      userStates.delete(userId);
      const labels: Record<string, string> = { m: 'minuto(s)', h: 'hora(s)', d: 'dia(s)' };
      await ctx.reply(`⏳ Cliente suspenso por ${amount} ${labels[unit]}! Até ${until.toLocaleString('pt-BR')}`);
      try {
        await bot.telegram.sendMessage(
          state.data.targetId,
          `⏳ Você foi suspenso da loja por ${amount} ${labels[unit]}.\nPoderá voltar a usar em: ${until.toLocaleString('pt-BR')}`
        );
      } catch (e) {}
      return;
    }

    if (state.step === 'admin_broadcast_text_msg') {
      const allUsers = await db.select().from(users);
      userStates.delete(userId);
      await ctx.reply(`📢 Transmitindo para ${allUsers.length} usuários...`);
      let cnt = 0;
      for (const u of allUsers) {
        try { await ctx.telegram.sendMessage(u.id, text); cnt++; } catch (e) {}
      }
      await ctx.reply(`✅ Transmissão concluída! ${cnt} receberam.`);
      return;
    }

    if (state.step === 'admin_broadcast_photo_msg') {
      state.data.text = text;
      state.step = 'admin_broadcast_photo_img';
      await ctx.reply('Agora envie a IMAGEM para a transmissão:');
      userStates.set(userId, state);
      return;
    }

    if (state.step === 'edit_welcome_text') {
      await storage.setSetting('welcome_text', text);
      userStates.delete(userId);
      await ctx.reply('✅ Texto de boas-vindas atualizado!');
      return;
    }

    if (state.step === 'search_stock_banco' || state.step === 'search_stock_bin' || state.step === 'search_stock_bandeira' || state.step === 'search_stock_level') {
      userStates.delete(userId);
      const results = await storage.searchAvailableStock(text);
      if (results.length === 0) {
        await ctx.reply('❌ Nenhum resultado encontrado para essa busca.');
        return;
      }
      const uniqueProducts = new Map<number, { name: string; price: number; count: number }>();
      for (const item of results) {
        const existing = uniqueProducts.get(item.productId!);
        if (existing) {
          existing.count++;
        } else {
          uniqueProducts.set(item.productId!, { name: item.productName, price: item.productPrice, count: 1 });
        }
      }
      const rows: any[] = [];
      const entries = Array.from(uniqueProducts.entries());
      for (let i = 0; i < entries.length; i += 2) {
        const [id1, p1] = entries[i];
        const row = [Markup.button.callback(`${p1.name} (${p1.count}) - R$${p1.price}`, `prod_${id1}`)];
        if (entries[i + 1]) {
          const [id2, p2] = entries[i + 1];
          row.push(Markup.button.callback(`${p2.name} (${p2.count}) - R$${p2.price}`, `prod_${id2}`));
        }
        rows.push(row);
      }
      await ctx.reply(`🔍 Resultados para "${text}" (${results.length} itens):`, Markup.inlineKeyboard(rows));
      return;
    }


    if (state.step === 'add_prod_name') {
      state.data.name = text;
      state.step = 'add_prod_price';
      await ctx.reply('Digite o PREÇO do produto (ex: 10.50):');
      userStates.set(userId, state);
      return;
    }

    if (state.step === 'add_prod_price') {
      const price = parseFloat(text.replace(',', '.'));
      if (isNaN(price)) return ctx.reply('Preço inválido.');
      state.data.price = price;
      state.step = 'add_prod_desc';
      await ctx.reply('Digite a DESCRIÇÃO do produto:');
      userStates.set(userId, state);
      return;
    }

    if (state.step === 'add_prod_desc') {
      state.data.description = text;
      const prod = await storage.createProduct({
        categoryId: state.data.categoryId,
        name: state.data.name,
        price: state.data.price,
        description: state.data.description,
      });
      userStates.delete(userId);
      await ctx.reply(`✅ Produto "${prod.name}" criado!`);
      return;
    }

    if (state.step === 'edit_prod_name') {
      if (text !== '.') state.data.name = text;
      state.step = 'edit_prod_price';
      await ctx.reply('Digite o NOVO PREÇO (ou "." para manter):');
      userStates.set(userId, state);
      return;
    }

    if (state.step === 'edit_prod_price') {
      if (text !== '.') {
        const price = parseFloat(text.replace(',', '.'));
        if (!isNaN(price)) state.data.price = price;
      }
      state.step = 'edit_prod_desc';
      await ctx.reply('Digite a NOVA DESCRIÇÃO (ou "." para manter):');
      userStates.set(userId, state);
      return;
    }

    if (state.step === 'edit_prod_desc') {
      const updates: any = {};
      if (state.data.name) updates.name = state.data.name;
      if (state.data.price) updates.price = state.data.price;
      if (text !== '.') updates.description = text;
      await db.update(products).set(updates).where(eq(products.id, state.data.productId));
      userStates.delete(userId);
      await ctx.reply('✅ Produto atualizado!');
      return;
    }

    if (state.step === 'set_min_pix') {
      const val = parseFloat(text.replace(',', '.'));
      if (isNaN(val)) return ctx.reply('Valor inválido.');
      await storage.setSetting('min_pix', val.toString());
      userStates.delete(userId);
      await ctx.reply(`✅ Mínimo PIX alterado para R$ ${val.toFixed(2)}`);
      return;
    }

    if (state.step === 'set_pix_bonus') {
      const val = parseInt(text);
      if (isNaN(val)) return ctx.reply('Valor inválido.');
      await storage.setSetting('pix_bonus', val.toString());
      userStates.delete(userId);
      await ctx.reply(`✅ Bônus PIX alterado para ${val}%`);
      return;
    }

    if (state.step === 'gen_gift_value') {
      const val = parseFloat(text.replace(',', '.'));
      if (isNaN(val)) return ctx.reply('Valor inválido.');
      const code = 'GIFT-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      await storage.createGift(code, val);
      userStates.delete(userId);
      await ctx.reply(`✅ GIFT GERADO!\n\nCódigo: \`${code}\`\nValor: R$ ${val.toFixed(2)}`, { parse_mode: 'Markdown' });
      return;
    }

}

if (text.length > 5 && !text.includes(’ ‘)) { const gift = await
storage.getGift(text); if (gift) { if (gift.isRedeemed) return
ctx.reply(’❌ Este Gift já foi resgatado.’); await
storage.redeemGift(gift.id, ctx.from.id); await
storage.updateUserBalance(ctx.from.id, gift.value); return
ctx.reply(✅ Gift resgatado!\n💰 +R$ ${gift.value.toFixed(2)} adicionados.);
} }

return next(); });

bot.hears(‘⬅️ VOLTAR’, async (ctx) => { await ctx.reply(‘Menu
Principal’, Markup.keyboard([ [‘🛒 PRODUTOS’, ‘💰 RECARREGAR SALDO’],
[‘🎁 RESGATAR GIFT’, ‘💳 MEU SALDO’], [‘📜 HISTÓRICO’], ]).resize());
});

bot.hears(‘💳 MEU SALDO’, async (ctx) => { const user = await
storage.getUser(ctx.from.id); const balance = user?.balance ?? 0; await
ctx.reply(💳 Seu saldo atual: R$ ${balance.toFixed(2)}); });

bot.hears(‘🛒 PRODUTOS’, async (ctx) => { const cats = await
storage.getCategories(); if (cats.length === 0) { const defaultCats =
[‘AMEX’, ‘BLACK’, ‘INFINITE’, ‘BUSINESS’, ‘PERSONAL’, ‘GOLD’,
‘PLATINUM’, ‘CLASSIC’, ‘STANDART’, ‘NUBANK BLACK’, ‘NUBANK PLATINUM’,
‘NUBANK GOLD’]; for (const cat of defaultCats) await
storage.createCategory(cat); return ctx.reply(‘Categorias inicializadas.
Tente novamente.’); } const rows: any[] = []; for (let i = 0; i <
cats.length; i += 2) { const row = [Markup.button.callback(cats[i].name,
cat_${cats[i].id})]; if (cats[i + 1])
row.push(Markup.button.callback(cats[i + 1].name,
cat_${cats[i + 1].id})); rows.push(row); }
rows.push([Markup.button.callback(‘🏦 Pesquisar banco’, ‘search_banco’),
Markup.button.callback(‘🔢 Pesquisar BIN’, ‘search_bin’)]);
rows.push([Markup.button.callback(‘💳 Pesquisa bandeira’,
‘search_bandeira’), Markup.button.callback(‘🏅 Pesquisar level’,
‘search_level’)]); rows.push([Markup.button.callback(‘⬅️ Voltar’,
‘back_menu’)]); await ctx.reply(‘Selecione uma categoria:’,
Markup.inlineKeyboard(rows)); });

bot.action(‘search_banco’, async (ctx) => { userStates.set(ctx.from!.id,
{ step: ‘search_stock_banco’, data: {} }); await ctx.reply(‘🏦 Digite o
nome do banco para pesquisar:’); });

bot.action(‘search_bin’, async (ctx) => { userStates.set(ctx.from!.id, {
step: ‘search_stock_bin’, data: {} }); await ctx.reply(‘🔢 Digite os 6
primeiros números (BIN) para pesquisar:’); });

bot.action(‘search_bandeira’, async (ctx) => {
userStates.set(ctx.from!.id, { step: ‘search_stock_bandeira’, data: {}
}); await ctx.reply(‘💳 Digite a bandeira para pesquisar (ex: Visa,
Mastercard, Elo):’); });

bot.action(‘search_level’, async (ctx) => { userStates.set(ctx.from!.id,
{ step: ‘search_stock_level’, data: {} }); await ctx.reply(‘🏅 Digite o
level para pesquisar (ex: Gold, Platinum, Black):’); });

bot.action(‘back_menu’, async (ctx) => {
userStates.delete(ctx.from!.id); await ctx.reply(‘Menu principal:’,
Markup.keyboard([ [‘🛒 PRODUTOS’, ‘💰 RECARREGAR SALDO’], [‘🎁 RESGATAR
GIFT’, ‘💳 MEU SALDO’], [‘📜 HISTÓRICO’], ]).resize()); });

bot.action(/^cat_()$/, async (ctx) => {  const categoryId = parseInt(ctx.match[1]);  const prods = await storage.getProductsByCategory(categoryId);  if (prods.length === 0) return ctx.reply('Nenhum produto nesta categoria.');  const rows: any[] = [];  for (let i = 0; i < prods.length; i += 2) {  const row = [Markup.button.callback(`${prods[i].name} -
R
$${prods[i].price}`, `prod_${prods[i].id}`)];
    if (prods[i + 1]) row.push(Markup.button.callback(`${prods[i + 1].name} - R$$
{prods[i + 1].price},prod_${prods[i + 1].id}`)); rows.push(row); } await
ctx.reply(‘Selecione um produto:’, Markup.inlineKeyboard(rows)); });

bot.action(/^prod_()$/, async (ctx) => {  const productId = parseInt(ctx.match[1]);  const product = await storage.getProduct(productId);  const stockCount = await storage.getStockCount(productId);  if (!product) return ctx.reply('Produto não encontrado.');  await ctx.reply(  `📦 *${product.name}*💰
Valor: R$ ${product.price}📦 Estoque:
${stockCount} disponíveis\n\n${product.description ||
’’},     { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('✅ COMPRAR',buy_${productId}`)]])
} ); });

bot.action(/^buy_()$/, async (ctx) => {  const productId = parseInt(ctx.match[1]);  const userId = ctx.from!.id;  const user = await storage.getUser(userId);  const product = await storage.getProduct(productId);  if (!user || !product) return ctx.reply('Erro ao processar compra.');  const stockCount = await storage.getStockCount(productId);  if (stockCount === 0) return ctx.reply('❌ Produto sem estoque no momento.');  if ((user.balance ?? 0) < product.price) return ctx.reply(`❌ Saldo insuficiente.\nSeu saldo: R$
${(user.balance ?? 0).toFixed(2)}\nPreço: R$
${product.price.toFixed(2)}`);

const stockItem = await storage.getNextAvailableStock(productId); if
(!stockItem) return ctx.reply(‘Erro de estoque.’); await
storage.updateUserBalance(userId, -product.price); await
storage.markStockSold(stockItem.id, userId); await
ctx.reply(✅ Compra realizada!\n\n📦 *Seu Produto:*\n\${stockItem.content}``,
{ parse_mode: ‘Markdown’ }); });

bot.hears(‘💰 RECARREGAR SALDO’, async (ctx) => {
userStates.set(ctx.from.id, { step: ‘recharge_amount’, data: {} });
await ctx.reply(‘💰 Digite o valor da recarga:’); });

bot.hears(‘🎁 RESGATAR GIFT’, async (ctx) => { await ctx.reply(‘🎁
Digite o código do Gift:’); });

export function getBotInstance() { return bot; }

export async function startBot(webhookDomain?: string) {
console.log(‘Starting Telegram Bot…’); bot.catch((err: any, ctx: any) =>
console.error(Bot Error: ${ctx.updateType}, err));
process.once(‘SIGINT’, () => bot.stop(‘SIGINT’));
process.once(‘SIGTERM’, () => bot.stop(‘SIGTERM’)); try { if
(webhookDomain) { const cleanDomain =
webhookDomain.split(‘,’)[0].trim().replace(/^https?:///, ’‘); const
webhookPath =’/api/telegram-webhook’; const webhookUrl =
https://${cleanDomain}${webhookPath}; await
bot.telegram.setWebhook(webhookUrl);
console.log(Bot webhook set to: ${webhookUrl}); } else {
console.log(‘Deleting webhook for polling mode…’); await
bot.telegram.deleteWebhook({ drop_pending_updates: true });
console.log(‘Webhook deleted, launching polling…’); await bot.launch({
dropPendingUpdates: true }); console.log(‘Bot started with polling!’); }
} catch (e) { console.error(‘Failed to start bot:’, e); } }

// ===== ESTOQUE EM MASSA VIA TXT ===== bot.on(‘message’, async (ctx) =>
{ if (!ctx.message) return; if (!(‘document’ in ctx.message)) return; if
(ctx.from?.id !== ADMIN_ID) return;

const state = userStates.get(ctx.from.id); if (!state || state.step !==
‘add_bulk_stock’) return;

const file = ctx.message.document;

if (!file.file_name?.endsWith(‘.txt’)) { return ctx.reply(‘❌ Envie um
arquivo .txt válido.’); }

await ctx.reply(‘📥 Processando arquivo…’);

const fileLink = await ctx.telegram.getFileLink(file.file_id); const
response = await fetch(fileLink.href); const text = await
response.text();

const stockItems = text .split(‘==’) .map(item => item.trim())
.filter(item => item.length > 0);

if (stockItems.length === 0) { return ctx.reply(‘❌ Nenhum item válido
encontrado no TXT.’); }

await storage.addStock( stockItems.map(content => ({ productId:
state.data.productId, content })) );

userStates.delete(ctx.from.id);

await
ctx.reply(✅ ${stockItems.length} itens adicionados via TXT com sucesso!);
});
