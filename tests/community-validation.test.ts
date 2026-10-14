import assert from "node:assert/strict";
import test from "node:test";
import { validateCircleForm, validateEventForm } from "../src/features/community/validation.ts";

const valid = { name: "Circle Data Pemula", description: "Belajar data science bareng setiap akhir pekan.", topic: "data_science" as const, scope: "open" as const, memberLimit: 12 };

test("accepts a safe Circle form", () => assert.equal(validateCircleForm(valid), null));
test("rejects contact details in a Circle", () => assert.match(validateCircleForm({ ...valid, description: "Hubungi aku di admin@example.com untuk belajar bersama." }) ?? "", /kontak/i));
test("enforces Circle member limits", () => assert.match(validateCircleForm({ ...valid, memberLimit: 40 }) ?? "", /3 sampai 30/i));

const validEvent = { title: "Belajar UI Bareng", description: "Belajar dasar UI dan membahas portofolio bersama.", category: "design" as const, scope: "open" as const, startsAtLocal: "2027-01-10T10:00", endsAtLocal: "2027-01-10T12:00", timezoneName: "Asia/Jakarta" as const, venueCategory: "campus_public_area" as const, venueName: "Perpustakaan Kampus", venueArea: "Lantai 2, ruang belajar bersama", city: "Jakarta", capacity: 20, registrationMode: "approval" as const, waitlistEnabled: true, safetyConfirmed: true };
test("accepts a safe Event form", () => assert.equal(validateEventForm(validEvent), null));
test("rejects an Event ending before it starts", () => assert.match(validateEventForm({ ...validEvent, endsAtLocal: "2027-01-10T09:00" }) ?? "", /setelah waktu mulai/i));
test("requires Event safety confirmation", () => assert.match(validateEventForm({ ...validEvent, safetyConfirmed: false }) ?? "", /keamanan/i));
