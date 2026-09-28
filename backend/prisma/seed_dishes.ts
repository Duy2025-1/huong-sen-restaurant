import { PrismaClient } from '@prisma/client';
// @ts-ignore
import { dishesPart1 } from './data/dishes_vietnamese_1';
// @ts-ignore
import { dishesPart2 } from './data/dishes_vietnamese_2';
// @ts-ignore
import { dishesPart3 } from './data/dishes_vietnamese_3';
// @ts-ignore
import { dishesPart4, authenticReviews } from './data/dishes_vietnamese_4';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Pure Authentic Vietnamese Dish & Menu Seeding ---');

  const allDishes = [...dishesPart1, ...dishesPart2, ...dishesPart3, ...dishesPart4];
  console.log(`Total 100% Vietnamese dishes to seed: ${allDishes.length}`);

  // Delete any old dishes that exceed the current authentic count to remove foreign/western items
  try {
    await prisma.dishModifierGroup.deleteMany({
      where: { dishId: { gt: allDishes.length } },
    });
    await prisma.review.deleteMany({});
    await prisma.dish.deleteMany({
      where: { id: { gt: allDishes.length } },
    });
  } catch (err) {
    console.warn('Note on clearing obsolete dishes:', err);
  }

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
        costPrice: Math.round(d.price * 0.42),
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
        preparationTimeMinutes: d.preparationTimeMinutes || 12,
        servingSize: d.servingSize || '1 phần',
        calories: d.calories || 350,
        spicyLevel: d.spicyLevel || 'NONE',
        ingredients: JSON.stringify(d.ingredients || []),
        allergens: JSON.stringify(d.allergens || []),
        nutrition: JSON.stringify(d.nutrition || { calories: d.calories || 350, protein: 20, carbs: 35, fat: 12 }),
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
        costPrice: Math.round(d.price * 0.42),
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
        preparationTimeMinutes: d.preparationTimeMinutes || 12,
        servingSize: d.servingSize || '1 phần',
        calories: d.calories || 350,
        spicyLevel: d.spicyLevel || 'NONE',
        ingredients: JSON.stringify(d.ingredients || []),
        allergens: JSON.stringify(d.allergens || []),
        nutrition: JSON.stringify(d.nutrition || { calories: d.calories || 350, protein: 20, carbs: 35, fat: 12 }),
        tags: JSON.stringify(d.tags || []),
      },
    });

    // Link appropriate modifier groups
    const modGroups: number[] = [];
    if (d.categoryId === 14) {
      // Drinks: Ice & Sugar levels
      modGroups.push(3, 4);
    } else if (d.categoryId === 12 || d.categoryId === 3 || d.categoryId === 10) {
      // Hotpot, Soup, Rice: Size & Topping & Spicy
      modGroups.push(1, 2, 5);
    } else {
      // General savory: Spicy & Size
      modGroups.push(1, 5);
    }

    for (const mgId of modGroups) {
      try {
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
      } catch (e) {
        // ignore if already exists
      }
    }

    seededCount++;
    if (seededCount % 25 === 0 || seededCount === allDishes.length) {
      console.log(`Seeded ${seededCount}/${allDishes.length} authentic Vietnamese dishes...`);
    }
  }

  // 2. Seed Realistic Authentic Reviews (Sample data)
  console.log(`Seeding ${authenticReviews.length} realistic customer reviews...`);
  for (const r of authenticReviews) {
    await prisma.review.create({
      data: {
        dishId: r.dishId,
        userName: r.userName,
        rating: r.rating,
        comment: r.comment,
        verifiedPurchase: true,
        helpfulCount: Math.floor(Math.random() * 8) + 2,
      },
    });
  }

  console.log('--- Pure Vietnamese Menu Seeding Completed Successfully! ---');
}

main()
  .catch((e) => {
    console.error('Error during menu seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
