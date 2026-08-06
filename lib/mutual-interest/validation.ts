import { z } from "zod";
import { conversationPublicIdSchema } from "../messages/validation.ts";

export const mutualInterestActionSchema = z.object({
  publicId: conversationPublicIdSchema,
});

export type MutualInterestActionInput = z.infer<
  typeof mutualInterestActionSchema
>;
