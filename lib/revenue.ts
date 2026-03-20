export const RAZORPAY_FEE_RATE = 0.02
export const GST_ON_FEE_RATE = 0.18

export type OrderAmountLike = {
  finalPrice?: number | null
  estimatedPrice?: number | null
}

export type RevenueBreakdown = {
  grossRevenue: number
  razorpayFees: number
  gstOnFees: number
  netRevenue: number
}

export function roundCurrency(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export function getOrderCollectedAmount(order: OrderAmountLike) {
  const finalPrice = Number(order.finalPrice)
  if (Number.isFinite(finalPrice) && finalPrice > 0) {
    return roundCurrency(finalPrice)
  }

  const estimatedPrice = Number(order.estimatedPrice)
  if (Number.isFinite(estimatedPrice) && estimatedPrice > 0) {
    return roundCurrency(estimatedPrice)
  }

  return 0
}

export function calculateRevenueBreakdownFromGross(grossAmount: number): RevenueBreakdown {
  const grossRevenue = roundCurrency(grossAmount)
  const razorpayFees = roundCurrency(grossRevenue * RAZORPAY_FEE_RATE)
  const gstOnFees = roundCurrency(razorpayFees * GST_ON_FEE_RATE)
  const netRevenue = roundCurrency(grossRevenue - razorpayFees - gstOnFees)

  return {
    grossRevenue,
    razorpayFees,
    gstOnFees,
    netRevenue
  }
}

export function addRevenueBreakdowns(
  left: RevenueBreakdown,
  right: RevenueBreakdown
): RevenueBreakdown {
  return {
    grossRevenue: roundCurrency(left.grossRevenue + right.grossRevenue),
    razorpayFees: roundCurrency(left.razorpayFees + right.razorpayFees),
    gstOnFees: roundCurrency(left.gstOnFees + right.gstOnFees),
    netRevenue: roundCurrency(left.netRevenue + right.netRevenue)
  }
}

export function createEmptyRevenueBreakdown(): RevenueBreakdown {
  return {
    grossRevenue: 0,
    razorpayFees: 0,
    gstOnFees: 0,
    netRevenue: 0
  }
}

export function summarizeDeliveredRevenue<T extends OrderAmountLike>(orders: T[]) {
  return orders.reduce((summary, order) => {
    const grossAmount = getOrderCollectedAmount(order)
    const breakdown = calculateRevenueBreakdownFromGross(grossAmount)
    return addRevenueBreakdowns(summary, breakdown)
  }, createEmptyRevenueBreakdown())
}
