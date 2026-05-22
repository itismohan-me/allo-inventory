import { z } from "zod";

export const CreateReservationSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const RESERVATION_TTL_MINUTES = 10;
