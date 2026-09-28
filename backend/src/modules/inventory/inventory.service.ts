import { prisma } from '../../config/prisma.js';
import { AuditService } from '../audit/audit.service.js';

export interface StockAdjustmentDto {
  ingredientId: number;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'WASTE';
  quantity: number; // positive number
  unitCost?: number;
  note?: string;
  staffId?: number | null;
  orderId?: number | null;
}

export class InventoryService {
  /**
   * Lấy danh sách toàn bộ nguyên liệu kèm trạng thái cảnh báo tồn kho
   */
  static async getIngredients() {
    const ingredients = await prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { transactions: true, recipeItems: true } },
      },
    });

    return ingredients.map((ing) => ({
      ...ing,
      isLowStock: ing.currentStock <= ing.minStock,
    }));
  }

  /**
   * Cảnh báo các nguyên liệu chạm ngưỡng tối thiểu
   */
  static async getLowStockAlerts() {
    const all = await prisma.ingredient.findMany({
      where: {
        currentStock: { lte: prisma.ingredient.fields.minStock as any },
      },
    });
    // In SQLite, verify directly
    return all.filter((i) => i.currentStock <= i.minStock);
  }

  /**
   * Biến động kho an toàn (ACID transaction)
   */
  static async recordTransaction(dto: StockAdjustmentDto) {
    return await prisma.$transaction(async (tx) => {
      const ing = await tx.ingredient.findUnique({
        where: { id: dto.ingredientId },
      });

      if (!ing) {
        throw new Error('Nguyên liệu không tồn tại trong hệ thống kho.');
      }

      const prevStock = ing.currentStock;
      let newStock = prevStock;

      if (dto.type === 'IN') {
        newStock = prevStock + dto.quantity;
      } else if (dto.type === 'OUT' || dto.type === 'WASTE') {
        newStock = Math.max(0, prevStock - dto.quantity);
      } else if (dto.type === 'ADJUSTMENT') {
        newStock = dto.quantity; // Set to actual physical counted stock
      }

      // Update ingredient current stock
      const updatedIng = await tx.ingredient.update({
        where: { id: ing.id },
        data: {
          currentStock: newStock,
          costPrice: dto.unitCost !== undefined && dto.unitCost > 0 ? dto.unitCost : ing.costPrice,
        },
      });

      // Record transaction
      const trans = await tx.inventoryTransaction.create({
        data: {
          ingredientId: ing.id,
          staffId: dto.staffId || null,
          orderId: dto.orderId || null,
          type: dto.type,
          quantity: dto.type === 'OUT' || dto.type === 'WASTE' ? -dto.quantity : dto.quantity,
          previousStock: prevStock,
          newStock,
          unitCost: dto.unitCost || ing.costPrice,
          note: dto.note || null,
        },
      });

      // Audit Log
      await AuditService.log({
        staffId: dto.staffId,
        action: `INVENTORY_${dto.type}`,
        entity: 'Ingredient',
        entityId: ing.id,
        oldValue: { stock: prevStock },
        newValue: { stock: newStock, delta: dto.quantity, type: dto.type },
      });

      return { ingredient: updatedIng, transaction: trans };
    });
  }

  /**
   * Trừ nguyên liệu tự động theo định lượng công thức món ăn (Recipe)
   */
  static async deductForOrderDish(dishId: number, quantity: number, orderId: number, staffId?: number | null) {
    const recipe = await prisma.recipe.findUnique({
      where: { dishId },
      include: { recipeItems: true },
    });

    if (!recipe || !recipe.recipeItems || recipe.recipeItems.length === 0) {
      return; // Dish doesn't have recipe registered
    }

    for (const item of recipe.recipeItems) {
      const requiredQty = item.quantity * quantity;
      try {
        await this.recordTransaction({
          ingredientId: item.ingredientId,
          type: 'OUT',
          quantity: requiredQty,
          orderId,
          staffId,
          note: `Xuất kho nấu món theo đơn hàng #${orderId}`,
        });
      } catch (err) {
        console.warn(`Could not deduct ingredient ${item.ingredientId} for order ${orderId}:`, err);
      }
    }
  }

  /**
   * Lấy danh sách công thức chế biến
   */
  static async getRecipes() {
    return prisma.recipe.findMany({
      include: {
        dish: { select: { id: true, name: true, price: true, category: { select: { name: true } } } },
        recipeItems: {
          include: { ingredient: true },
        },
      },
    });
  }
}
