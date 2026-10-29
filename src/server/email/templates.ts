import type { Locale } from "@/lib/api/types";
import { formatAmd } from "@/lib/money";

export type EmailTemplate =
  | "welcome"
  | "account_exists"
  | "password_reset"
  | "order_confirmation"
  | "payment_pending"
  | "payment_confirmed"
  | "payment_failed"
  | "order_status"
  | "order_shipped"
  | "order_cancelled"
  | "order_refunded"
  | "admin_new_order"
  | "contact_receipt";

export interface EmailItem {
  name: string;
  quantity: number;
  lineTotal: number;
}

export interface EmailData {
  siteUrl: string;
  name?: string;
  orderNumber?: string;
  total?: number;
  items?: EmailItem[];
  status?: string;
  resetUrl?: string;
  orderUrl?: string;
  paymentMethod?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

type Copy = { subject: (d: EmailData) => string; lines: (d: EmailData) => string[]; cta?: (d: EmailData) => { label: string; url: string } | null };

const STATUS_LABEL: Record<Locale, Record<string, string>> = {
  hy: {
    pending: "Ընդունված",
    awaiting_payment: "Սպասում է վճարման",
    paid: "Վճարված",
    processing: "Մշակվում է",
    shipped: "Առաքված",
    delivered: "Հանձնված",
    cancelled: "Չեղարկված",
    refunded: "Վերադարձված",
    payment_failed: "Վճարումը ձախողվեց",
    expired: "Ժամկետանց",
  },
  ru: {
    pending: "Принят",
    awaiting_payment: "Ожидает оплаты",
    paid: "Оплачен",
    processing: "В обработке",
    shipped: "Отправлен",
    delivered: "Доставлен",
    cancelled: "Отменён",
    refunded: "Возврат оформлен",
    payment_failed: "Оплата не прошла",
    expired: "Истёк срок",
  },
  en: {
    pending: "Received",
    awaiting_payment: "Awaiting payment",
    paid: "Paid",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
    payment_failed: "Payment failed",
    expired: "Expired",
  },
};

const hello: Record<Locale, (n?: string) => string> = {
  hy: (n) => (n ? `Բարև ${n},` : "Բարև Ձեզ,"),
  ru: (n) => (n ? `Здравствуйте, ${n}!` : "Здравствуйте!"),
  en: (n) => (n ? `Hello ${n},` : "Hello,"),
};

const totalLabel: Record<Locale, string> = { hy: "Ընդամենը", ru: "Итого", en: "Total" };
const viewOrder: Record<Locale, string> = { hy: "Դիտել պատվերը", ru: "Посмотреть заказ", en: "View order" };
const footer: Record<Locale, string> = {
  hy: "Vape Hub — միայն 18 տարեկանից բարձր անձանց համար։ Նիկոտինը առաջացնում է կախվածություն։",
  ru: "Vape Hub — только для лиц старше 18 лет. Никотин вызывает зависимость.",
  en: "Vape Hub — for adults 18+ only. Nicotine is an addictive substance.",
};

const orderCta = (l: Locale) => (d: EmailData) => (d.orderUrl ? { label: viewOrder[l], url: d.orderUrl } : null);

const COPY: Record<Locale, Record<EmailTemplate, Copy>> = {
  hy: {
    welcome: { subject: () => "Բարի գալուստ Vape Hub", lines: () => ["Ձեր հաշիվը ստեղծված է։ Այժմ կարող եք հետևել պատվերներին և պահպանել հասցեները։"] },
    account_exists: {
      subject: () => "Գրանցման փորձ Ձեր էլ. հասցեով",
      lines: () => ["Ինչ-որ մեկը փորձել է գրանցվել այս էլ. հասցեով, որն արդեն ունի հաշիվ։ Եթե դա Դուք էիք, մուտք գործեք կամ վերականգնեք գաղտնաբառը։ Եթե ոչ, պարզապես անտեսեք այս նամակը։"],
    },
    password_reset: {
      subject: () => "Գաղտնաբառի վերականգնում",
      lines: () => ["Գաղտնաբառը փոխելու համար սեղմեք ներքևի կոճակը։ Հղումը գործում է 30 րոպե և կարող է օգտագործվել մեկ անգամ։", "Եթե Դուք չեք պահանջել վերականգնում, անտեսեք այս նամակը։"],
      cta: (d) => (d.resetUrl ? { label: "Նոր գաղտնաբառ", url: d.resetUrl } : null),
    },
    order_confirmation: { subject: (d) => `Պատվեր ${d.orderNumber} ընդունված է`, lines: () => ["Շնորհակալություն պատվերի համար։ Մենք կկապվենք Ձեզ հետ առաքման մանրամասները ճշտելու համար։"], cta: orderCta("hy") },
    payment_pending: { subject: (d) => `Պատվեր ${d.orderNumber}․ սպասում ենք վճարմանը`, lines: () => ["Պատվերը պահված է։ Ավարտեք վճարումը, որպեսզի ապրանքները մնան Ձեզ համար։"], cta: orderCta("hy") },
    payment_confirmed: { subject: (d) => `Պատվեր ${d.orderNumber}․ վճարումը հաստատված է`, lines: () => ["Ձեր վճարումը ստացվել է։ Պատվերը փոխանցվում է մշակման։"], cta: orderCta("hy") },
    payment_failed: { subject: (d) => `Պատվեր ${d.orderNumber}․ վճարումը չհաջողվեց`, lines: () => ["Վճարումը չի հաստատվել։ Գումար չի գանձվել։ Կարող եք կրկին փորձել կամ ընտրել այլ եղանակ։"], cta: orderCta("hy") },
    order_status: { subject: (d) => `Պատվեր ${d.orderNumber}․ նոր կարգավիճակ`, lines: (d) => [`Պատվերի կարգավիճակը՝ ${STATUS_LABEL.hy[d.status ?? ""] ?? d.status}։`], cta: orderCta("hy") },
    order_shipped: { subject: (d) => `Պատվեր ${d.orderNumber}․ առաքված է`, lines: () => ["Ձեր պատվերը ճանապարհին է։ Առաքիչը կզանգահարի նախքան այցելելը։"], cta: orderCta("hy") },
    order_cancelled: { subject: (d) => `Պատվեր ${d.orderNumber}․ չեղարկված է`, lines: () => ["Ձեր պատվերը չեղարկվել է։ Եթե վճարում է կատարվել, այն կվերադարձվի։"], cta: orderCta("hy") },
    order_refunded: { subject: (d) => `Պատվեր ${d.orderNumber}․ գումարի վերադարձ`, lines: () => ["Գումարի վերադարձը ձևակերպված է։ Միջոցների հասանելիության ժամկետը կախված է վճարային համակարգից։"], cta: orderCta("hy") },
    admin_new_order: { subject: (d) => `Նոր պատվեր ${d.orderNumber}`, lines: (d) => [`Վճարման եղանակ՝ ${d.paymentMethod ?? ""}`] },
    contact_receipt: { subject: () => "Ձեր հաղորդագրությունը ստացվել է", lines: () => ["Շնորհակալություն դիմելու համար։ Մենք կպատասխանենք աշխատանքային ժամերին։"] },
  },
  ru: {
    welcome: { subject: () => "Добро пожаловать в Vape Hub", lines: () => ["Ваш аккаунт создан. Теперь вы можете отслеживать заказы и сохранять адреса."] },
    account_exists: {
      subject: () => "Попытка регистрации с вашим e-mail",
      lines: () => ["Кто-то пытался зарегистрироваться с этим адресом, но аккаунт уже существует. Если это были вы — войдите или восстановите пароль. Если нет — просто проигнорируйте письмо."],
    },
    password_reset: {
      subject: () => "Восстановление пароля",
      lines: () => ["Нажмите кнопку ниже, чтобы задать новый пароль. Ссылка действует 30 минут и может быть использована один раз.", "Если вы не запрашивали восстановление, проигнорируйте это письмо."],
      cta: (d) => (d.resetUrl ? { label: "Задать новый пароль", url: d.resetUrl } : null),
    },
    order_confirmation: { subject: (d) => `Заказ ${d.orderNumber} принят`, lines: () => ["Спасибо за заказ! Мы свяжемся с вами, чтобы уточнить детали доставки."], cta: orderCta("ru") },
    payment_pending: { subject: (d) => `Заказ ${d.orderNumber}: ожидаем оплату`, lines: () => ["Товары зарезервированы. Завершите оплату, чтобы сохранить резерв."], cta: orderCta("ru") },
    payment_confirmed: { subject: (d) => `Заказ ${d.orderNumber}: оплата подтверждена`, lines: () => ["Мы получили оплату. Заказ передан в обработку."], cta: orderCta("ru") },
    payment_failed: { subject: (d) => `Заказ ${d.orderNumber}: оплата не прошла`, lines: () => ["Платёж не был подтверждён, деньги не списаны. Попробуйте снова или выберите другой способ."], cta: orderCta("ru") },
    order_status: { subject: (d) => `Заказ ${d.orderNumber}: новый статус`, lines: (d) => [`Статус заказа: ${STATUS_LABEL.ru[d.status ?? ""] ?? d.status}.`], cta: orderCta("ru") },
    order_shipped: { subject: (d) => `Заказ ${d.orderNumber} отправлен`, lines: () => ["Ваш заказ в пути. Курьер позвонит перед доставкой."], cta: orderCta("ru") },
    order_cancelled: { subject: (d) => `Заказ ${d.orderNumber} отменён`, lines: () => ["Ваш заказ отменён. Если оплата была произведена, она будет возвращена."], cta: orderCta("ru") },
    order_refunded: { subject: (d) => `Заказ ${d.orderNumber}: возврат средств`, lines: () => ["Возврат оформлен. Срок зачисления зависит от платёжной системы."], cta: orderCta("ru") },
    admin_new_order: { subject: (d) => `Новый заказ ${d.orderNumber}`, lines: (d) => [`Способ оплаты: ${d.paymentMethod ?? ""}`] },
    contact_receipt: { subject: () => "Мы получили ваше сообщение", lines: () => ["Спасибо за обращение. Мы ответим в рабочее время."] },
  },
  en: {
    welcome: { subject: () => "Welcome to Vape Hub", lines: () => ["Your account is ready. You can now track orders and save delivery addresses."] },
    account_exists: {
      subject: () => "Sign-up attempt with your email",
      lines: () => ["Someone tried to create an account with this email, but an account already exists. If this was you, sign in or reset your password. Otherwise you can ignore this email."],
    },
    password_reset: {
      subject: () => "Reset your password",
      lines: () => ["Use the button below to choose a new password. The link is valid for 30 minutes and can be used once.", "If you did not request a reset, you can ignore this email."],
      cta: (d) => (d.resetUrl ? { label: "Choose a new password", url: d.resetUrl } : null),
    },
    order_confirmation: { subject: (d) => `Order ${d.orderNumber} received`, lines: () => ["Thank you for your order. We will contact you to confirm delivery details."], cta: orderCta("en") },
    payment_pending: { subject: (d) => `Order ${d.orderNumber}: awaiting payment`, lines: () => ["Your items are reserved. Complete the payment to keep the reservation."], cta: orderCta("en") },
    payment_confirmed: { subject: (d) => `Order ${d.orderNumber}: payment confirmed`, lines: () => ["We received your payment. Your order is now being processed."], cta: orderCta("en") },
    payment_failed: { subject: (d) => `Order ${d.orderNumber}: payment failed`, lines: () => ["The payment was not confirmed and you were not charged. You can try again or choose another method."], cta: orderCta("en") },
    order_status: { subject: (d) => `Order ${d.orderNumber}: status update`, lines: (d) => [`Your order status is now: ${STATUS_LABEL.en[d.status ?? ""] ?? d.status}.`], cta: orderCta("en") },
    order_shipped: { subject: (d) => `Order ${d.orderNumber} has shipped`, lines: () => ["Your order is on its way. The courier will call before arrival."], cta: orderCta("en") },
    order_cancelled: { subject: (d) => `Order ${d.orderNumber} cancelled`, lines: () => ["Your order has been cancelled. Any payment made will be refunded."], cta: orderCta("en") },
    order_refunded: { subject: (d) => `Order ${d.orderNumber}: refund issued`, lines: () => ["Your refund has been issued. Timing depends on your payment provider."], cta: orderCta("en") },
    admin_new_order: { subject: (d) => `New order ${d.orderNumber}`, lines: (d) => [`Payment method: ${d.paymentMethod ?? ""}`] },
    contact_receipt: { subject: () => "We received your message", lines: () => ["Thanks for reaching out. We reply during business hours."] },
  },
};

export function renderEmail(template: EmailTemplate, locale: Locale, data: EmailData): RenderedEmail {
  const copy = COPY[locale][template];
  const subject = copy.subject(data);
  const lines = copy.lines(data);
  const cta = copy.cta?.(data) ?? null;
  const items = data.items ?? [];

  const textParts = [hello[locale](data.name), "", ...lines];
  if (items.length) {
    textParts.push("", ...items.map((i) => `${i.name} × ${i.quantity} — ${formatAmd(i.lineTotal)}`));
  }
  if (typeof data.total === "number") textParts.push(`${totalLabel[locale]}: ${formatAmd(data.total)}`);
  if (cta) textParts.push("", `${cta.label}: ${cta.url}`);
  textParts.push("", footer[locale]);

  const itemRows = items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;color:#fafafa">${escapeHtml(i.name)} × ${i.quantity}</td><td style="padding:6px 0;text-align:right;color:#fafafa">${escapeHtml(formatAmd(i.lineTotal))}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#0c0c0d;font-family:Arial,Helvetica,sans-serif;color:#c9cad1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0c0c0d"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141516;border-radius:10px">
<tr><td style="padding:20px 24px;background:#7641ba;border-radius:10px 10px 0 0;color:#fafafa;font-size:20px;font-weight:bold;letter-spacing:2px">VAPE HUB</td></tr>
<tr><td style="padding:24px">
<p style="margin:0 0 12px;color:#fafafa">${escapeHtml(hello[locale](data.name))}</p>
${lines.map((l) => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(l)}</p>`).join("")}
${itemRows ? `<table role="presentation" width="100%" style="margin:12px 0;border-top:1px solid #333">${itemRows}</table>` : ""}
${typeof data.total === "number" ? `<p style="margin:12px 0;color:#fafafa;font-weight:bold">${totalLabel[locale]}: ${escapeHtml(formatAmd(data.total))}</p>` : ""}
${cta ? `<p style="margin:20px 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:12px 20px;background:#7641ba;color:#fafafa;text-decoration:none;font-weight:bold">${escapeHtml(cta.label)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;color:#92949f;border-top:1px solid #26272b">${escapeHtml(footer[locale])}</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, html, text: textParts.join("\n") };
}
