import { PrismaClient } from '@prisma/client';
import { savoryDishes } from './data/dishes_savory';
import { westernDishes } from './data/dishes_western';
import { drinksAndDessertsDishes, sampleReviews } from './data/dishes_drinks_desserts';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Dish & Menu Seeding ---');

  const allDishes = [...savoryDishes, ...westernDishes, ...drinksAndDessertsDishes];
  console.log(`Total dishes to seed: ${allDishes.length}`);

  // 1. Upsert Dishes
  let seededCount = 0;
  for (const d of allDishes) {
    const discountedPrice = d.discount && d.discount > 0 ? d.price : null;

    await prisma.dish.upsert({
      where: { id: d.id },
      update: {
        categoryId: d.categoryId,
        stationId: d.stationId,
        name: d.name,
        slug: d.slug,
        shortDescription: d.shortDescription,
        description: d.description,
        price: d.price,
        originalPrice: d.originalPrice,
        discountedPrice: discountedPrice,
        discount: d.discount || 0,
        currency: 'VND',
        imageUrl: d.imageUrl,
        gallery: JSON.stringify(d.gallery || [d.imageUrl]),
        rating: d.rating || 4.8,
        reviewCount: d.reviewCount || 0,
        soldCount: d.soldCount || 0,
        isAvailable: d.isAvailable ?? true,
        isBestSeller: d.isBestSeller ?? false,
        isNew: d.isNew ?? false,
        isPopular: d.isPopular ?? false,
        preparationTimeMinutes: d.preparationTimeMinutes || 15,
        servingSize: d.servingSize || '1 phần',
        calories: d.calories || 450,
        spicyLevel: d.spicyLevel || 'NONE',
        ingredients: JSON.stringify(d.ingredients || []),
        allergens: JSON.stringify(d.allergens || []),
        nutrition: JSON.stringify(d.nutrition || { calories: d.calories || 450, protein: 20, carbs: 40, fat: 15 }),
        tags: JSON.stringify(d.tags || []),
      },
      create: {
        id: d.id,
        categoryId: d.categoryId,
        stationId: d.stationId,
        name: d.name,
        slug: d.slug,
        shortDescription: d.shortDescription,
        description: d.description,
        price: d.price,
        originalPrice: d.originalPrice,
        discountedPrice: discountedPrice,
        discount: d.discount || 0,
        currency: 'VND',
        imageUrl: d.imageUrl,
        gallery: JSON.stringify(d.gallery || [d.imageUrl]),
        rating: d.rating || 4.8,
        reviewCount: d.reviewCount || 0,
        soldCount: d.soldCount || 0,
        isAvailable: d.isAvailable ?? true,
        isBestSeller: d.isBestSeller ?? false,
        isNew: d.isNew ?? false,
        isPopular: d.isPopular ?? false,
        preparationTimeMinutes: d.preparationTimeMinutes || 15,
        servingSize: d.servingSize || '1 phần',
        calories: d.calories || 450,
        spicyLevel: d.spicyLevel || 'NONE',
        ingredients: JSON.stringify(d.ingredients || []),
        allergens: JSON.stringify(d.allergens || []),
        nutrition: JSON.stringify(d.nutrition || { calories: d.calories || 450, protein: 20, carbs: 40, fat: 15 }),
        tags: JSON.stringify(d.tags || []),
      },
    });

    // Link modifier groups if specified
    if (d.modifierGroupIds && d.modifierGroupIds.length > 0) {
      for (const mgId of d.modifierGroupIds) {
        await prisma.dishModifierGroup.upsert({
          where: {
            dishId_modifierGroupId: {
              dishId: d.id,
              modifierGroupId: mgId,
            },
          },
          update: {},
          create: {
            dishId: d.id,
            modifierGroupId: mgId,
          },
        });
      }
    }

    seededCount++;
    if (seededCount % 25 === 0 || seededCount === allDishes.length) {
      console.log(`Seeded ${seededCount}/${allDishes.length} dishes...`);
    }
  }

  // 2. Seed Sample Reviews
  console.log(`Seeding ${sampleReviews.length} sample reviews...`);
  // Clean existing sample reviews first or create new ones
  await prisma.review.deleteMany({});
  for (const r of sampleReviews) {
    await prisma.review.create({
      data: {
        dishId: r.dishId,
        userName: r.userName,
        avatar: r.avatar,
        rating: r.rating,
        comment: r.comment,
        verifiedPurchase: r.verifiedPurchase,
        helpfulCount: r.helpfulCount,
      },
    });
  }

  console.log('--- Dish & Menu Seeding Completed Successfully! ---');
}

main()
  .catch((e) => {
    console.error('Error during menu seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
