import type { ClientSession, Types } from "mongoose";
import { InventoryMovement, Product, Reservation } from "../models";

/**
 * Atomic conditional decrement. The stock condition lives inside the update filter,
 * so two concurrent buyers can never both take the last unit: exactly one update
 * matches; the other sees modifiedCount === 0.
 */
export async function decrementStock(
  session: ClientSession,
  productId: Types.ObjectId,
  variantId: Types.ObjectId,
  quantity: number,
): Promise<boolean> {
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError("quantity must be a positive integer");
  const res = await Product.updateOne(
    {
      _id: productId,
      status: "active",
      variants: { $elemMatch: { _id: variantId, active: true, stock: { $gte: quantity } } },
    },
    { $inc: { "variants.$.stock": -quantity, salesCount: quantity } },
    { session },
  );
  return res.modifiedCount === 1;
}

/** Restores stock. Callers must only invoke this after a conditional reservation transition succeeded. */
export async function incrementStock(session: ClientSession, productId: Types.ObjectId, variantId: Types.ObjectId, quantity: number): Promise<void> {
  await Product.updateOne(
    { _id: productId, "variants._id": variantId },
    { $inc: { "variants.$.stock": quantity, salesCount: -quantity } },
    { session },
  );
}

/**
 * Releases every active/consumed reservation of an order exactly once and restores
 * stock for each reservation whose conditional transition actually happened.
 * Returns the number of reservations released.
 */
export async function releaseOrderReservations(
  session: ClientSession,
  orderId: Types.ObjectId,
  to: "released" | "expired",
  from: ("active" | "consumed")[] = ["active", "consumed"],
): Promise<number> {
  const reservations = await Reservation.find({ orderId, status: { $in: from } }).session(session);
  let released = 0;
  const now = new Date();
  for (const r of reservations) {
    const res = await Reservation.updateOne({ _id: r._id, status: r.status }, { $set: { status: to, releasedAt: now } }, { session });
    if (res.modifiedCount === 1) {
      await incrementStock(session, r.productId, r.variantId, r.quantity);
      await InventoryMovement.create(
        [
          {
            productId: r.productId,
            variantId: r.variantId,
            sku: r.sku,
            delta: r.quantity,
            stockBefore: -1,
            stockAfter: -1,
            reason: `${to} reservation for order ${String(orderId)}`,
            kind: "release",
            actorId: null,
          },
        ],
        { session },
      );
      released += 1;
    }
  }
  return released;
}

/** Consumes all active reservations of an order. Returns how many transitioned. */
export async function consumeOrderReservations(session: ClientSession, orderId: Types.ObjectId): Promise<number> {
  const res = await Reservation.updateMany({ orderId, status: "active" }, { $set: { status: "consumed", consumedAt: new Date() } }, { session });
  return res.modifiedCount;
}
