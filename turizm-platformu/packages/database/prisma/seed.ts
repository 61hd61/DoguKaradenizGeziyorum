// Database Seed Script
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Create provinces
  const provinces = [
    { name: "Trabzon", slug: "trabzon", code: "61", latitude: 41.0082, longitude: 39.7269, zoom: 10 },
    { name: "Giresun", slug: "giresun", code: "28", latitude: 40.9128, longitude: 38.3895, zoom: 10 },
    { name: "Ordu", slug: "ordu", code: "52", latitude: 40.9833, longitude: 37.8833, zoom: 10 },
    { name: "Gümüşhane", slug: "gumushane", code: "29", latitude: 40.4603, longitude: 39.4814, zoom: 10 },
    { name: "Rize", slug: "rize", code: "53", latitude: 41.0208, longitude: 40.5219, zoom: 10 },
    { name: "Artvin", slug: "artvin", code: "08", latitude: 41.1819, longitude: 41.8183, zoom: 10 },
  ];

  for (const p of provinces) {
    await prisma.province.upsert({
      where: { slug: p.slug },
      update: p,
      create: p,
    });
  }
  console.log("✅ Provinces created");

  // Create destination types
  const types = [
    { name: "Cami", slug: "cami", icon: "mosque", color: "#1e88e5", sortOrder: 1 },
    { name: "Türbe", slug: "turbe", icon: "tomb", color: "#8e24aa", sortOrder: 2 },
    { name: "Kilise", slug: "kilise", icon: "church", color: "#e53935", sortOrder: 3 },
    { name: "Şapel", slug: "sapel", icon: "chapel", color: "#d81b60", sortOrder: 4 },
    { name: "Kale", slug: "kale", icon: "castle", color: "#6d4c41", sortOrder: 5 },
    { name: "Tarihi Bina", slug: "tarihi-bina", icon: "building", color: "#5d4037", sortOrder: 6 },
    { name: "Han", slug: "han", icon: "warehouse", color: "#795548", sortOrder: 7 },
    { name: "Hamam", slug: "hamam", icon: "bath", color: "#00acc1", sortOrder: 8 },
    { name: "Şelale", slug: "selale", icon: "waterfall", color: "#00bcd4", sortOrder: 9 },
    { name: "Köprü", slug: "kopru", icon: "bridge", color: "#43a047", sortOrder: 10 },
    { name: "Sivil Mimari", slug: "sivil-mimari", icon: "architecture", color: "#fb8c00", sortOrder: 11 },
    { name: "Mağara", slug: "magara", icon: "cave", color: "#757575", sortOrder: 12 },
    { name: "Milli Park", slug: "milli-park", icon: "park", color: "#43a047", sortOrder: 13 },
    { name: "Müze", slug: "muze", icon: "museum", color: "#fdd835", sortOrder: 14 },
    { name: "Şenlikler", slug: "senlikler", icon: "festival", color: "#ec407a", sortOrder: 15 },
    { name: "Göl", slug: "gol", icon: "lake", color: "#29b6f6", sortOrder: 16 },
    { name: "Kanyon", slug: "kanyon", icon: "canyon", color: "#8d6e63", sortOrder: 17 },
  ];

  for (const t of types) {
    await prisma.destinationType.upsert({
      where: { slug: t.slug },
      update: t,
      create: t,
    });
  }
  console.log("✅ Destination types created");

  // Create admin user
  const adminPassword = await hash("admin123");
  await prisma.adminUser.upsert({
    where: { email: "admin@turizm.local" },
    update: {},
    create: {
      email: "admin@turizm.local",
      passwordHash: adminPassword,
      name: "Admin User",
      role: "SUPER_ADMIN",
      permissions: ["*"],
    },
  });
  console.log("✅ Admin user created (admin@turizm.local / admin123)");

  // Create test user
  const userPassword = await hash("test1234");
  const user = await prisma.user.upsert({
    where: { email: "test@turizm.local" },
    update: {},
    create: {
      email: "test@turizm.local",
      username: "@testuser",
      passwordHash: userPassword,
      isEmailVerified: true,
      role: "USER",
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      firstName: "Test",
      lastName: "User",
      bio: "Test kullanıcısı",
    },
  });
  console.log("✅ Test user created (test@turizm.local / test1234)");

  // Create sample destinations for each province
  const trabzon = await prisma.province.findUnique({ where: { slug: "trabzon" } });
  const camiType = await prisma.destinationType.findUnique({ where: { slug: "cami" } });
  const selaleType = await prisma.destinationType.findUnique({ where: { slug: "selale" } });
  const kaleType = await prisma.destinationType.findUnique({ where: { slug: "kale" } });
  const muzeType = await prisma.destinationType.findUnique({ where: { slug: "muze" } });
  const milliParkType = await prisma.destinationType.findUnique({ where: { slug: "milli-park" } });

  if (trabzon && camiType && selaleType && kaleType && muzeType && milliParkType) {
    const sampleDestinations = [
      {
        name: "Ayasofya Camii (Trabzon)",
        slug: "ayasofya-camii-trabzon",
        description: "13. yüzyılda inşa edilen, freskleriyle ünlü tarihi cami.",
        shortDescription: "Freskleriyle ünlü 13. yüzyıl tarihi cami",
        typeId: camiType.id,
        provinceId: trabzon.id,
        latitude: 41.0027,
        longitude: 39.7167,
        address: "Ayasofya Mahallesi, 61000 Trabzon",
        isActive: true,
        isFeatured: true,
      },
      {
        name: "Uzun Sokak",
        slug: "uzun-sokak",
        description: "Trabzon'un en ünlü alışveriş ve yürüyüş caddesi.",
        shortDescription: "Trabzon'un kalbi, alışveriş caddesi",
        typeId: muzeType.id, // Using muze as placeholder for sivil mimari
        provinceId: trabzon.id,
        latitude: 41.005,
        longitude: 39.725,
        address: "Kemerkaya Mahallesi, 61000 Trabzon",
        isActive: true,
        isFeatured: true,
      },
      {
        name: "Çal Mağarası",
        slug: "cal-magarasi",
        description: "Dünyanın en uzun mağaralarından biri, içindeki şelalesiyle ünlüdür.",
        shortDescription: "İçinde şelalesi olan dev mağara",
        typeId: await prisma.destinationType.findUnique({ where: { slug: "magara" } }).then(t => t?.id || camiType.id),
        provinceId: trabzon.id,
        latitude: 40.85,
        longitude: 39.55,
        address: "Çal Köyü, Düzköy, Trabzon",
        isActive: true,
        isFeatured: false,
      },
    ];

    for (const d of sampleDestinations) {
      await prisma.destination.upsert({
        where: { slug: d.slug },
        update: d,
        create: d,
      });
    }
    console.log("✅ Sample destinations created");
  }

  // Create popular routes
  await prisma.popularRoute.createMany({
    data: [
      {
        name: "Trabzon Tarihi Yarımada Turu",
        description: "Trabzon'un tarihi yarımadasındaki Ayasofya, Ortahisar, Trabzon Kalesi ve Atatürk Köşkü'nü kapsar.",
        destinationIds: [],
        provinceIds: ["trabzon"],
        vehicleType: "WALKING",
        participantType: "FAMILY",
        totalDuration: 240,
        totalDistance: 5,
        usageCount: 150,
        averageRating: 4.5,
      },
      {
        name: "Uzungöl - Ayder Yaylası Rotası",
        description: "Doğa severler için Uzungöl'den Ayder Yaylası'na güzergah.",
        destinationIds: [],
        provinceIds: ["trabzon", "rize"],
        vehicleType: "CAR",
        participantType: "FAMILY",
        totalDuration: 480,
        totalDistance: 120,
        usageCount: 89,
        averageRating: 4.7,
      },
      {
        name: "Sümela Manastırı ve Altındere Vadisi",
        description: "Macka ilçesindeki Sümela Manastırı ve Milli Parkı turu.",
        destinationIds: [],
        provinceIds: ["trabzon"],
        vehicleType: "CAR",
        participantType: "SOLO",
        totalDuration: 300,
        totalDistance: 45,
        usageCount: 234,
        averageRating: 4.8,
      },
    ],
    skipDuplicates: true,
  });
  console.log("✅ Popular routes created");

  console.log("🎉 Database seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });