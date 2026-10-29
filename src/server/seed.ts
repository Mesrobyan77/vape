import type { Localized } from "@/lib/api/types";
import { config } from "./config";
import { connectDb } from "./db";
import {
  BlogPost,
  Brand,
  CapturedEmail,
  Cart,
  Category,
  ContactMessage,
  Coupon,
  InventoryMovement,
  NewsletterSubscription,
  Order,
  Outbox,
  PaymentEvent,
  PaymentTransaction,
  Product,
  RateLimitHit,
  Reservation,
  Session,
  Settings,
  User,
  AuditLog,
  PasswordReset,
  Media,
  type ImageRef,
} from "./models";

/**
 * Deterministic development/test fixtures mirroring the reference template's catalogue.
 * NEVER runs in production (guarded below and by every caller).
 */

const l = (hy: string, ru: string, en: string): Localized => ({ hy, ru, en });
const img = (url: string, width: number, height: number, alt: Localized = l("", "", "")): ImageRef => ({ url, publicId: null, alt, width, height });

const NICOTINE_WARNING = l(
  "Այս ապրանքը պարունակում է նիկոտին՝ ուժեղ կախվածություն առաջացնող նյութ։ Միայն 18 տարեկանից բարձր անձանց համար։ Պահել երեխաներից հեռու։",
  "Этот продукт содержит никотин — вещество, вызывающее сильную зависимость. Только для лиц старше 18 лет. Храните в недоступном для детей месте.",
  "This product contains nicotine, which is a highly addictive substance. For adults 18+ only. Keep out of reach of children.",
);
const DEVICE_WARNING = l(
  "Սարքը նախատեսված է հեղուկների համար, որոնք կարող են պարունակել նիկոտին։ Միայն 18+։ Լիցքավորեք միայն համապատասխան մալուխով և մի թողեք առանց հսկողության։",
  "Устройство предназначено для жидкостей, которые могут содержать никотин. Только 18+. Заряжайте подходящим кабелем и не оставляйте без присмотра.",
  "Device intended for e-liquids that may contain nicotine. 18+ only. Charge with a suitable cable and never leave charging unattended.",
);

export const SEED_CATEGORIES = [
  { slug: "vapor-tech", name: l("Vapor Tech", "Vapor Tech", "Vapor Tech"), image: img("/media/categories/cat-img-1.png", 236, 332), sortOrder: 1 },
  { slug: "cloud-max", name: l("Cloud Max", "Cloud Max", "Cloud Max"), image: img("/media/categories/cat-img-2.png", 234, 332), sortOrder: 2 },
  { slug: "zen-pulse", name: l("Zen Pulse", "Zen Pulse", "Zen Pulse"), image: img("/media/categories/cat-img-3.png", 236, 332), sortOrder: 3 },
  { slug: "koko-prime", name: l("Koko Prime", "Koko Prime", "Koko Prime"), image: img("/media/categories/cat-img-4.png", 234, 332), sortOrder: 4 },
  { slug: "nova-vape", name: l("Nova Vape", "Nova Vape", "Nova Vape"), image: img("/media/categories/cat-img-5.png", 236, 332), sortOrder: 5 },
  { slug: "premium-vapes", name: l("Պրեմիում վեյփեր", "Премиум вейпы", "Premium Vapes"), image: img("/media/categories/category-1.jpg", 704, 360), sortOrder: 6 },
  { slug: "elite-vapor", name: l("Elite Vapor", "Elite Vapor", "Elite Vapor"), image: img("/media/categories/category-2.jpg", 704, 360), sortOrder: 7 },
  { slug: "disposable-vape", name: l("Մեկանգամյա վեյփեր", "Одноразовые вейпы", "Disposable Vapes"), image: null, sortOrder: 8 },
  { slug: "pod-systems", name: l("Փոդ համակարգեր", "Под-системы", "Pod Systems"), image: null, sortOrder: 9 },
  { slug: "coils", name: l("Գոլորշիչներ", "Испарители", "Coils"), image: null, sortOrder: 10 },
  { slug: "e-juices", name: l("Հեղուկներ", "Жидкости", "E-Juices"), image: img("/media/bg/banner-2-bg.png", 1432, 349), sortOrder: 11 },
];

export const SEED_BRANDS = [
  { slug: "voodoo", name: "Voodoo", logo: img("/media/brands/brand01.png", 247, 96) },
  { slug: "xmods", name: "XMods", logo: img("/media/brands/brand02.png", 248, 96) },
  { slug: "uwell", name: "Uwell", logo: img("/media/brands/brand03.png", 248, 96) },
  { slug: "vaporesso", name: "Vaporesso", logo: img("/media/brands/brand04.png", 248, 96) },
  { slug: "geekvape", name: "Geekvape", logo: img("/media/brands/brand05.png", 248, 96) },
  { slug: "vopo", name: "Vopo", logo: img("/media/brands/brand06.png", 248, 96) },
  { slug: "smok", name: "Smok", logo: img("/media/brands/brand07.png", 247, 96) },
];

interface SeedVariant {
  sku: string;
  price: number;
  salePrice?: number;
  stock: number;
  flavor?: string;
  nicotineMg?: number;
  volumeMl?: number;
  color?: string;
}

interface SeedProduct {
  slug: string;
  name: string;
  category: string;
  brand: string;
  image: string;
  gallery?: boolean;
  featured: boolean;
  kind: "device" | "liquid";
  feature: Localized;
  tags: string[];
  variants: SeedVariant[];
  salesCount: number;
}

const P = (url: string) => img(url, 308, 332);

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    slug: "ignition",
    name: "Ignition",
    category: "vapor-tech",
    brand: "vaporesso",
    image: "/media/products/p-01.png",
    featured: true,
    kind: "device",
    feature: l("կոմպակտ մոդ՝ կարգավորվող օդահոսքով և USB-C լիցքավորմամբ", "компактный мод с регулируемой затяжкой и зарядкой USB-C", "a compact mod with adjustable airflow and USB-C charging"),
    tags: ["mod", "device", "usb-c"],
    variants: [
      { sku: "IGN-BLK", price: 18900, stock: 25, color: "Black" },
      { sku: "IGN-SLV", price: 18900, stock: 12, color: "Silver" },
    ],
    salesCount: 140,
  },
  {
    slug: "aero-core",
    name: "Aero Core",
    category: "pod-systems",
    brand: "uwell",
    image: "/media/products/p-02.png",
    featured: true,
    kind: "device",
    feature: l("թեթև փոդ համակարգ՝ փոխարինվող քարթրիջներով", "лёгкая под-система со сменными картриджами", "a lightweight pod system with refillable cartridges"),
    tags: ["pod", "device"],
    variants: [{ sku: "AC-STD", price: 14500, stock: 30, color: "Red" }],
    salesCount: 210,
  },
  {
    slug: "vape-edge",
    name: "Vape Edge",
    category: "premium-vapes",
    brand: "vopo",
    image: "/media/products/p-03.png",
    gallery: true,
    featured: true,
    kind: "device",
    feature: l("պրեմիում սարք՝ մետաղական իրանով և OLED էկրանով", "премиальное устройство в металлическом корпусе с OLED-экраном", "a premium device with a metal body and OLED display"),
    tags: ["premium", "device", "oled"],
    variants: [
      { sku: "VE-GRY", price: 24900, salePrice: 19900, stock: 15, color: "Graphite" },
      { sku: "VE-PRP", price: 24900, stock: 8, color: "Purple" },
    ],
    salesCount: 95,
  },
  {
    slug: "vaporize",
    name: "Vaporize",
    category: "cloud-max",
    brand: "smok",
    image: "/media/products/p-04.png",
    featured: true,
    kind: "device",
    feature: l("հզոր բոքս-մոդ՝ երկու մարտկոցով", "мощный бокс-мод на двух аккумуляторах", "a powerful dual-battery box mod"),
    tags: ["box-mod", "device"],
    variants: [{ sku: "VPZ-STD", price: 45000, stock: 6, color: "Black" }],
    salesCount: 60,
  },
  {
    slug: "aeropulse",
    name: "AeroPulse",
    category: "zen-pulse",
    brand: "geekvape",
    image: "/media/products/p-05.png",
    featured: true,
    kind: "device",
    feature: l("ամուր սարք՝ ջրի և հարվածների դեմ պաշտպանությամբ", "прочное устройство с защитой от воды и ударов", "a rugged device with water and shock resistance"),
    tags: ["rugged", "device"],
    variants: [{ sku: "AP-STD", price: 21500, stock: 20, color: "Teal" }],
    salesCount: 120,
  },
  {
    slug: "novafume",
    name: "NovaFume",
    category: "nova-vape",
    brand: "voodoo",
    image: "/media/products/p-06.png",
    featured: false,
    kind: "device",
    feature: l("դասական մոդ՝ ձեռքով կարգավորումներով", "классический мод с ручными настройками", "a classic mod with manual settings"),
    tags: ["mod", "device"],
    variants: [{ sku: "NF-STD", price: 12900, stock: 0, color: "Black" }],
    salesCount: 30,
  },
  {
    slug: "vaporize-mini",
    name: "Vaporize Mini",
    category: "disposable-vape",
    brand: "smok",
    image: "/media/products/p-07.png",
    featured: true,
    kind: "liquid",
    feature: l("մեկանգամյա սարք՝ պատրաստ օգտագործման", "одноразовое устройство, готовое к использованию", "a ready-to-use disposable device"),
    tags: ["disposable"],
    variants: [
      { sku: "VM-MANGO-20", price: 6900, stock: 40, flavor: "Mango Ice", nicotineMg: 20 },
      { sku: "VM-BLUE-20", price: 6900, stock: 22, flavor: "Blueberry", nicotineMg: 20 },
      { sku: "VM-MELON-20", price: 6900, stock: 3, flavor: "Watermelon", nicotineMg: 20 },
    ],
    salesCount: 300,
  },
  {
    slug: "nebulaxt",
    name: "NebulaXt",
    category: "elite-vapor",
    brand: "xmods",
    image: "/media/products/p-08.png",
    featured: true,
    kind: "device",
    feature: l("ժամանակակից մոդ՝ ճշգրիտ ջերմաստիճանի կառավարմամբ", "современный мод с точным контролем температуры", "a modern mod with precise temperature control"),
    tags: ["mod", "device", "temperature-control"],
    variants: [{ sku: "NX-STD", price: 32000, stock: 10, color: "Blue" }],
    salesCount: 75,
  },
  {
    slug: "titanvape",
    name: "TitanVape",
    category: "pod-systems",
    brand: "geekvape",
    image: "/media/products/p-03.png",
    featured: false,
    kind: "device",
    feature: l("սահմանափակ թողարկման փոդ համակարգ", "под-система ограниченной серии", "a limited-edition pod system"),
    tags: ["pod", "limited"],
    variants: [{ sku: "TV-ONE", price: 16500, stock: 1, color: "Titanium" }],
    salesCount: 10,
  },
  {
    slug: "double-apple",
    name: "Double Apple",
    category: "e-juices",
    brand: "voodoo",
    image: "/media/products/pf-01.png",
    featured: false,
    kind: "liquid",
    feature: l("կանաչ և կարմիր խնձորի համով հեղուկ", "жидкость со вкусом зелёного и красного яблока", "an e-liquid with a green and red apple flavour"),
    tags: ["e-liquid", "fruit"],
    variants: [
      { sku: "DA-30-3", price: 4900, stock: 40, flavor: "Double Apple", nicotineMg: 3, volumeMl: 30 },
      { sku: "DA-30-6", price: 4900, stock: 25, flavor: "Double Apple", nicotineMg: 6, volumeMl: 30 },
      { sku: "DA-60-0", price: 7900, stock: 18, flavor: "Double Apple", nicotineMg: 0, volumeMl: 60 },
      { sku: "DA-60-12", price: 7900, stock: 0, flavor: "Double Apple", nicotineMg: 12, volumeMl: 60 },
    ],
    salesCount: 180,
  },
  {
    slug: "dual-aroma",
    name: "Dual Aroma",
    category: "e-juices",
    brand: "vopo",
    image: "/media/products/pf-02.png",
    featured: false,
    kind: "liquid",
    feature: l("անանուխի և հատապտուղների համադրություն", "сочетание мяты и ягод", "a blend of mint and berries"),
    tags: ["e-liquid", "mint"],
    variants: [
      { sku: "DAR-30-3", price: 5400, stock: 30, flavor: "Mint Berry", nicotineMg: 3, volumeMl: 30 },
      { sku: "DAR-30-12", price: 5400, stock: 14, flavor: "Mint Berry", nicotineMg: 12, volumeMl: 30 },
    ],
    salesCount: 90,
  },
  {
    slug: "twin-fruit",
    name: "Twin Fruit",
    category: "e-juices",
    brand: "voodoo",
    image: "/media/products/pf-03.png",
    featured: false,
    kind: "liquid",
    feature: l("արևադարձային մրգերի համով հեղուկ", "жидкость со вкусом тропических фруктов", "an e-liquid with a tropical fruit flavour"),
    tags: ["e-liquid", "fruit"],
    variants: [
      { sku: "TF-30-6", price: 5200, stock: 20, flavor: "Tropical Fruit", nicotineMg: 6, volumeMl: 30 },
      { sku: "TF-60-3", price: 8400, stock: 11, flavor: "Tropical Fruit", nicotineMg: 3, volumeMl: 60 },
    ],
    salesCount: 70,
  },
  {
    slug: "pair-vapor",
    name: "Pair Vapor",
    category: "e-juices",
    brand: "vopo",
    image: "/media/products/pf-04.png",
    featured: false,
    kind: "liquid",
    feature: l("կոլայի և սառույցի համով աղային հեղուկ", "солевая жидкость со вкусом колы со льдом", "a salt e-liquid with a cola ice flavour"),
    tags: ["e-liquid", "salt"],
    variants: [
      { sku: "PV-30-20", price: 5900, stock: 26, flavor: "Cola Ice", nicotineMg: 20, volumeMl: 30 },
      { sku: "PV-30-12", price: 5900, stock: 9, flavor: "Cola Ice", nicotineMg: 12, volumeMl: 30 },
    ],
    salesCount: 110,
  },
];

function productTexts(p: SeedProduct): { short: Localized; description: Localized } {
  const f = p.feature;
  return {
    short: l(`${p.name}՝ ${f.hy}։`, `${p.name} — ${f.ru}.`, `${p.name} — ${f.en}.`),
    description: l(
      `${p.name}՝ ${f.hy}։ Ապրանքը վաճառվում է օրիգինալ փաթեթավորմամբ և երաշխիքային կտրոնով։\n\nՆախքան օգտագործելը կարդացեք արտադրողի հրահանգը։ Պահեք չոր, զով վայրում՝ երեխաներից հեռու։`,
      `${p.name} — ${f.ru}. Товар поставляется в оригинальной упаковке с гарантийным талоном.\n\nПеред использованием прочитайте инструкцию производителя. Храните в сухом прохладном месте, недоступном для детей.`,
      `${p.name} — ${f.en}. Supplied in the original packaging with a warranty card.\n\nRead the manufacturer's instructions before use. Store in a cool, dry place out of reach of children.`,
    ),
  };
}

const GALLERY = [img("/media/products/pd-1.png", 704, 593), img("/media/products/pd-2.png", 704, 593), img("/media/products/pd-3.png", 704, 593), img("/media/products/pd-4.png", 704, 593)];

const BLOG = [
  {
    slug: "how-to-choose-your-first-pod-system",
    image: "/media/blogs/blog-01.jpg",
    category: "guides",
    title: l("Ինչպես ընտրել առաջին փոդ համակարգը", "Как выбрать первую под-систему", "How to choose your first pod system"),
    excerpt: l("Հիմնական չափանիշներ՝ մարտկոց, քարթրիջ և լիցքավորում։", "Основные критерии: аккумулятор, картридж и зарядка.", "The basics to compare: battery, cartridge and charging."),
    body: l(
      "Փոդ համակարգերը կոմպակտ են և հեշտ օգտագործման։ Համեմատեք մարտկոցի տարողությունը, քարթրիջի ծավալը և լիցքավորման միակցիչը։\n\nԸնտրեք սարք, որի համար փոխարինվող քարթրիջները հասանելի են մեր խանութում։ Միշտ հետևեք արտադրողի հրահանգներին։",
      "Под-системы компактны и просты в использовании. Сравните ёмкость аккумулятора, объём картриджа и тип разъёма для зарядки.\n\nВыбирайте устройство, сменные картриджи для которого есть в продаже. Всегда следуйте инструкциям производителя.",
      "Pod systems are compact and simple to use. Compare battery capacity, cartridge volume and the charging connector.\n\nChoose a device whose replacement cartridges are easy to find, and always follow the manufacturer's instructions.",
    ),
  },
  {
    slug: "understanding-nicotine-strengths",
    image: "/media/blogs/blog-02.jpg",
    category: "guides",
    title: l("Ինչ են նշանակում նիկոտինի խտության պիտակները", "Что означают обозначения крепости никотина", "Understanding nicotine strength labels"),
    excerpt: l("mg/ml, աղային նիկոտին և ինչպես կարդալ պիտակը։", "mg/ml, солевой никотин и как читать этикетку.", "mg/ml, salt nicotine and how to read a label."),
    body: l(
      "Պիտակի վրա նիկոտինի խտությունը նշվում է միլիգրամ մեկ միլիլիտրում (mg/ml)։ Աղային հեղուկները սովորաբար ունեն ավելի բարձր խտություն և նախատեսված են փոդ համակարգերի համար։\n\nՆիկոտինը առաջացնում է կախվածություն։ Ապրանքները նախատեսված են միայն չափահասների համար։",
      "Крепость указывается в миллиграммах на миллилитр (mg/ml). Солевые жидкости обычно крепче и рассчитаны на под-системы.\n\nНикотин вызывает зависимость. Продукция предназначена только для совершеннолетних.",
      "Strength is shown in milligrams per millilitre (mg/ml). Salt-nicotine liquids are usually stronger and designed for pod systems.\n\nNicotine is addictive. These products are intended for adults only.",
    ),
  },
  {
    slug: "caring-for-your-device",
    image: "/media/blogs/blog-03.jpg",
    category: "maintenance",
    title: l("Սարքի և գոլորշիչների խնամք", "Уход за устройством и испарителями", "Caring for your device and coils"),
    excerpt: l("Պարզ սովորություններ՝ սարքի կյանքը երկարացնելու համար։", "Простые привычки, которые продлят жизнь устройства.", "Simple habits that keep your device working longer."),
    body: l(
      "Պարբերաբար մաքրեք միակցիչները չոր անձեռոցիկով և փոխարինեք գոլորշիչը, երբ համը փոխվում է։\n\nՄի թողեք սարքը արևի տակ կամ տաք մեքենայում և օգտագործեք միայն համապատասխան լիցքավորիչ։",
      "Регулярно протирайте контакты сухой салфеткой и меняйте испаритель, когда вкус ухудшается.\n\nНе оставляйте устройство на солнце или в нагретом автомобиле и используйте подходящее зарядное устройство.",
      "Wipe the contacts with a dry cloth regularly and replace the coil when the flavour changes.\n\nDo not leave the device in direct sun or a hot car, and use a suitable charger only.",
    ),
  },
  {
    slug: "e-liquid-storage-tips",
    image: "/media/blogs/blog-04.jpg",
    category: "maintenance",
    title: l("Ինչպես ճիշտ պահել հեղուկները", "Как правильно хранить жидкости", "Storing e-liquids safely"),
    excerpt: l("Զով, մութ և երեխաներից հեռու։", "Прохладно, темно и недоступно для детей.", "Cool, dark and out of reach of children."),
    body: l(
      "Հեղուկները պահեք փակ շշերում, զով և մութ վայրում։ Միշտ փակեք կափարիչը՝ երեխաներից պաշտպանված։\n\nԵթե հեղուկը փոխել է գույնը կամ հոտը, մի օգտագործեք այն։",
      "Храните жидкости в закрытых флаконах в прохладном тёмном месте. Всегда закрывайте крышку с защитой от детей.\n\nЕсли жидкость изменила цвет или запах, не используйте её.",
      "Keep bottles closed in a cool, dark place, and always close the child-resistant cap.\n\nIf a liquid has changed colour or smell, do not use it.",
    ),
  },
  {
    slug: "travel-notes-for-vapers",
    image: "/media/blogs/blog-05.jpg",
    category: "news",
    title: l("Ճամփորդություն վեյփով․ գործնական նշումներ", "Путешествие с вейпом: практические заметки", "Travelling with a vape: practical notes"),
    excerpt: l("Մարտկոցներ, ձեռքի ուղեբեռ և տեղական կանոններ։", "Аккумуляторы, ручная кладь и местные правила.", "Batteries, carry-on luggage and local rules."),
    body: l(
      "Ավիաընկերությունների մեծ մասը թույլ է տալիս սարքերը միայն ձեռքի ուղեբեռում։ Նախապես ստուգեք ավիաընկերության և նպատակակետ երկրի կանոնները։\n\nՏեղափոխեք պահեստային մարտկոցները պաշտպանիչ պատյաններում։",
      "Большинство авиакомпаний разрешают перевозить устройства только в ручной клади. Заранее проверьте правила перевозчика и страны назначения.\n\nПеревозите запасные аккумуляторы в защитных кейсах.",
      "Most airlines allow devices in carry-on luggage only. Check the airline's and destination country's rules in advance.\n\nCarry spare batteries in protective cases.",
    ),
  },
  {
    slug: "vape-hub-opens-in-yerevan",
    image: "/media/blogs/blog-06.jpg",
    category: "news",
    title: l("Vape Hub-ը բացվում է Երևանում", "Vape Hub открывается в Ереване", "Vape Hub opens in Yerevan"),
    excerpt: l("Առցանց խանութ՝ առաքմամբ ամբողջ Հայաստանում։", "Онлайн-магазин с доставкой по всей Армении.", "An online store delivering across Armenia."),
    body: l(
      "Vape Hub-ը առցանց խանութ է չափահասների համար՝ առաքմամբ Երևանում և մարզերում։\n\nԲոլոր գները ներառում են ԱԱՀ, իսկ առաքման արժեքը ցույց է տրվում նախքան պատվերը հաստատելը։",
      "Vape Hub — интернет-магазин для совершеннолетних с доставкой по Еревану и регионам.\n\nВсе цены включают НДС, а стоимость доставки показывается до подтверждения заказа.",
      "Vape Hub is an online store for adults with delivery in Yerevan and the regions.\n\nAll prices include VAT, and the delivery fee is shown before you confirm your order.",
    ),
  },
];

const ALL_MODELS = [
  BlogPost,
  Brand,
  CapturedEmail,
  Cart,
  Category,
  ContactMessage,
  Coupon,
  InventoryMovement,
  NewsletterSubscription,
  Order,
  Outbox,
  PaymentEvent,
  PaymentTransaction,
  Product,
  RateLimitHit,
  Reservation,
  Session,
  Settings,
  User,
  AuditLog,
  PasswordReset,
  Media,
] as const;

function assertNotProduction(): void {
  if (config().isProduction) throw new Error("Seeding is disabled in production.");
}

/** Deletes every document (indexes are kept). Test/dev only. */
export async function resetDatabase(): Promise<void> {
  assertNotProduction();
  await connectDb();
  for (const model of ALL_MODELS) await (model as unknown as { deleteMany: (f: object) => Promise<unknown> }).deleteMany({});
}

/** Ensures every index exists (transactions cannot create collections implicitly on older servers). */
export async function ensureIndexes(): Promise<void> {
  await connectDb();
  for (const model of ALL_MODELS) {
    await (model as unknown as { createCollection: () => Promise<unknown> }).createCollection().catch(() => undefined);
    await (model as unknown as { syncIndexes: () => Promise<unknown> }).syncIndexes();
  }
}

export async function seedDatabase(opts: { reset?: boolean } = {}): Promise<{ products: number; categories: number; brands: number; posts: number }> {
  assertNotProduction();
  await connectDb();
  if (opts.reset !== false) await resetDatabase();
  await ensureIndexes();

  const cats = await Category.insertMany(SEED_CATEGORIES.map((c) => ({ ...c, description: l("", "", ""), active: true })));
  const brands = await Brand.insertMany(SEED_BRANDS.map((b, i) => ({ ...b, sortOrder: i, active: true })));
  const catId = new Map(cats.map((c) => [c.slug, c._id]));
  const brandId = new Map(brands.map((b) => [b.slug, b._id]));

  // Created sequentially (older first) so "newest" sorting is deterministic.
  const base = Date.UTC(2026, 0, 1);
  let i = 0;
  for (const p of SEED_PRODUCTS) {
    const texts = productTexts(p);
    const product = new Product({
      slug: p.slug,
      name: l(p.name, p.name, p.name),
      shortDescription: texts.short,
      description: texts.description,
      categoryId: catId.get(p.category) ?? null,
      brandId: brandId.get(p.brand) ?? null,
      tags: p.tags,
      images: [P(p.image), ...(p.gallery ? GALLERY : [])].map((im) => ({ ...im, alt: l(p.name, p.name, p.name) })),
      variants: p.variants.map((v) => ({
        sku: v.sku,
        attributes: { flavor: v.flavor ?? null, nicotineMg: v.nicotineMg ?? null, volumeMl: v.volumeMl ?? null, color: v.color ?? null, resistanceOhm: null },
        label: l("", "", ""),
        price: v.price,
        salePrice: v.salePrice ?? null,
        stock: v.stock,
        images: [],
        active: true,
      })),
      status: "active",
      featured: p.featured,
      salesCount: p.salesCount,
      warnings: p.kind === "liquid" ? [NICOTINE_WARNING] : [DEVICE_WARNING],
      seo: { title: l("", "", ""), description: texts.short },
    });
    const created = new Date(base + i * 86_400_000);
    product.set("createdAt", created);
    product.set("updatedAt", created);
    await product.save({ timestamps: false });
    i += 1;
  }

  await BlogPost.insertMany(
    BLOG.map((b, idx) => ({
      slug: b.slug,
      title: b.title,
      excerpt: b.excerpt,
      body: b.body,
      coverImage: img(b.image, 462, 498, b.title),
      category: b.category,
      tags: ["vaping", b.category],
      readMinutes: 4 + (idx % 3),
      status: "published",
      publishedAt: new Date(base + idx * 7 * 86_400_000),
    })),
  );

  await Coupon.insertMany([
    { code: "WELCOME10", type: "percent", value: 10, minSubtotal: 5000, active: true, startsAt: null, endsAt: null, usageLimit: null },
    { code: "EXPIRED5", type: "percent", value: 5, minSubtotal: 0, active: true, startsAt: null, endsAt: new Date(Date.UTC(2020, 0, 1)), usageLimit: null },
  ]);

  await Settings.create({
    key: "store",
    vatRatePercent: 20,
    shipping: { yerevanFee: 1000, otherFee: 2000, freeThreshold: 20000 },
    reservationTtlMinutes: 30,
    banners: [
      {
        title: l("Ստացեք լավագույն փորձառությունը", "Получите лучший опыт", "Get the best vaping experience"),
        subtitle: l("", "", ""),
        image: img("/media/bg/banner-1-bg.png", 1432, 500),
        link: "/shop",
        placement: "promo",
        active: true,
        sortOrder: 0,
      },
      {
        title: l("Բացահայտեք հեղուկները", "Откройте для себя жидкости", "Explore E-Juices"),
        subtitle: l("", "", ""),
        image: img("/media/bg/banner-2-bg.png", 1432, 349),
        link: "/shop?category=e-juices",
        placement: "promo",
        active: true,
        sortOrder: 1,
      },
    ],
    store: {
      phone: "+374 00 000 000",
      email: "hello@vapehub.example",
      address: l("Երևան, Հայաստան", "Ереван, Армения", "Yerevan, Armenia"),
      hours: l("10:00 – 21:00", "10:00 – 21:00", "10:00 – 21:00"),
    },
  });

  return { products: SEED_PRODUCTS.length, categories: SEED_CATEGORIES.length, brands: SEED_BRANDS.length, posts: BLOG.length };
}
