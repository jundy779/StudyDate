import { z } from "zod";

export const studyProgramManageSchema = z
  .object({
    action: z.enum(["create", "update", "approve", "reject", "delete"]),
    id: z.string().uuid().optional().nullable(),
    name: z
      .string()
      .trim()
      .min(2, "Nama jurusan minimal 2 karakter.")
      .max(120, "Nama jurusan maksimal 120 karakter.")
      .optional()
      .nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.action === "create" && !value.name) {
      ctx.addIssue({
        code: "custom",
        message: "Nama jurusan wajib diisi.",
        path: ["name"],
      });
    }
    if (
      (value.action === "update" ||
        value.action === "approve" ||
        value.action === "reject" ||
        value.action === "delete") &&
      !value.id
    ) {
      ctx.addIssue({
        code: "custom",
        message: "ID jurusan wajib.",
        path: ["id"],
      });
    }
  });
