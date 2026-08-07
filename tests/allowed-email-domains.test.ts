import assert from "node:assert/strict";
import test from "node:test";
import {
  isAllowedStudentEmail,
  getEmailDomain,
} from "../lib/auth/allowed-email-domains.ts";

test("student email allowlist accepts gmail, vk, ac.id, sch.id", () => {
  assert.equal(isAllowedStudentEmail("a@gmail.com"), true);
  assert.equal(isAllowedStudentEmail("a@vk.com"), true);
  assert.equal(isAllowedStudentEmail("a@ui.ac.id"), true);
  assert.equal(isAllowedStudentEmail("a@sekolah.sch.id"), true);
  assert.equal(isAllowedStudentEmail("a@ac.id"), true);
  assert.equal(isAllowedStudentEmail("a@sch.id"), true);
});

test("student email allowlist rejects other domains", () => {
  assert.equal(isAllowedStudentEmail("a@yahoo.com"), false);
  assert.equal(isAllowedStudentEmail("a@outlook.com"), false);
  assert.equal(isAllowedStudentEmail("a@ac.id.com"), false);
  assert.equal(isAllowedStudentEmail("not-an-email"), false);
  assert.equal(getEmailDomain("x@GMAIL.COM"), "gmail.com");
});
