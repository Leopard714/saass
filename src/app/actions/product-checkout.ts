"use server"

import { auth } from "@/lib/auth/auth"
import { prisma } from "@/lib/prisma"
import { validateCartStock } from "./cart"
import type { CartItem } from "@/store/cart-store"

const TAX_RATE = 0.08
const FREE_SHIPPING_THRESHOLD = 50
const SHIPPING_COST = 5.99

interface CheckoutResult {
  success: boolean
  orderId?: string
  error?: string
  stockErrors?: any[]
}

export async function createProductCheckoutSession(
  items: CartItem[]
): Promise<CheckoutResult> {
  try {
    const session = await auth()

    if (!session?.user) {
      return { success: false, error: "You must be logged in" }
    }

    if (!items.length) {
      return { success: false, error: "Cart is empty" }
    }

    // Stock check
    const stockValidation = await validateCartStock(items)
    if (!stockValidation.valid) {
      return {
        success: false,
        error: "Some items are out of stock",
        stockErrors: stockValidation.errors,
      }
    }

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    )

    const shipping =
      subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST

    const tax = subtotal * TAX_RATE
    const total = subtotal + shipping + tax

    // Customer
    let customerId: string | null = null

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { customer: true },
    })

    if (user?.customer) {
      customerId = user.customer.id
    } else if (user) {
      const customer = await prisma.customer.create({
        data: {
          name: user.name || "Customer",
          email: user.email,
          userId: user.id,
        },
      })
      customerId = customer.id
    }

    // Create order directly (NO PAYMENT)
    const order = await prisma.order.create({
      data: {
        customerId,
        subtotal,
        tax,
        total,
        status: "PAID", // auto-mark as paid since no Stripe
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
    })

    return {
      success: true,
      orderId: order.id,
    }
  } catch (error) {
    console.error(error)
    return {
      success: false,
      error: "Checkout failed",
    }
  }
}