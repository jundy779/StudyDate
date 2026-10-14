import assert from "node:assert/strict";
import test from "node:test";
import { validateCircleForm } from "../src/features/community/validation.ts";

const valid = { name: "Circle Data Pemula", description: "Belajar data science bareng setiap akhir pekan.", topic: "data_science" as const, scope: "open" as const, memberLimit: 12 };

test("accepts a safe Circle form", () => assert.equal(validateCircleForm(valid), null));
test("rejects contact details in a Circle", () => assert.match(validateCircleForm({ ...valid, description: "Hubungi aku di admin@example.com untuk belajar bersama." }) ?? "", /kontak/i));
test("enforces Circle member limits", () => assert.match(validateCircleForm({ ...valid, memberLimit: 40 }) ?? "", /3 sampai 30/i));
