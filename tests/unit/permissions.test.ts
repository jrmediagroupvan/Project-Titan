import test from "node:test";
import assert from "node:assert/strict";
import { PermissionKey, Role } from "@prisma/client";
import { roleAllows } from "../../lib/permissions";

test("owner receives customer deletion by default", () => {
  assert.equal(roleAllows(Role.OWNER, PermissionKey.CUSTOMERS_DELETE), true);
});

test("non-owner roles require an explicit customer deletion grant", () => {
  for (const role of Object.values(Role).filter((value) => value !== Role.OWNER)) {
    assert.equal(roleAllows(role, PermissionKey.CUSTOMERS_DELETE), false);
  }
});

test("only owner receives AI action approval by default", () => {
  assert.equal(roleAllows(Role.OWNER, PermissionKey.AI_ACTIONS_APPROVE), true);
  for (const role of Object.values(Role).filter((value) => value !== Role.OWNER)) {
    assert.equal(roleAllows(role, PermissionKey.AI_ACTIONS_APPROVE), false);
  }
});

test("staff AI tools are granular", () => {
  assert.equal(roleAllows(Role.STAFF, PermissionKey.AI_CRM_SEARCH), true);
  assert.equal(roleAllows(Role.STAFF, PermissionKey.AI_PRICING_USE), true);
  assert.equal(roleAllows(Role.STAFF, PermissionKey.AI_ACTIONS_APPROVE), false);
});

test("AI STL permissions preserve role and destructive-action boundaries", () => {
  assert.equal(roleAllows(Role.OWNER, PermissionKey.AI_STL_DELETE), true);
  assert.equal(roleAllows(Role.STAFF, PermissionKey.AI_STL_CREATE), true);
  assert.equal(roleAllows(Role.PRODUCTION, PermissionKey.AI_STL_EXPORT), true);
  assert.equal(roleAllows(Role.STAFF, PermissionKey.AI_STL_DELETE), false);
});
