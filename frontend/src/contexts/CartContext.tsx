import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CartItem {
  dish: any;
  quantity: number;
  selectedModifiers: any[];
  kitchenNote: string;
  itemTotalPrice: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (dish: any, quantity: number, selectedModifiers: any[], kitchenNote: string) => void;
  updateQuantity: (index: number, newQty: number) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  cartTotal: number;
  totalItemCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType>({} as CartContextType);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('rms_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('rms_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (dish: any, quantity: number, selectedModifiers: any[], kitchenNote: string) => {
    let extraPrice = 0;
    selectedModifiers.forEach((m) => {
      extraPrice += m.additionalPrice || 0;
    });

    const unitPrice = dish.discountedPrice || dish.price;
    const itemTotalPrice = (unitPrice + extraPrice) * quantity;

    setCart((prev) => [
      ...prev,
      {
        dish,
        quantity,
        selectedModifiers,
        kitchenNote,
        itemTotalPrice,
      },
    ]);
  };

  const updateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }

    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const unitPrice = item.dish.discountedPrice || item.dish.price;
      const extraPrice = item.selectedModifiers.reduce((sum, m) => sum + (m.additionalPrice || 0), 0);

      updated[index] = {
        ...item,
        quantity: newQty,
        itemTotalPrice: (unitPrice + extraPrice) * newQty,
      };
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.itemTotalPrice, 0);
  const totalItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        cartTotal,
        totalItemCount,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
