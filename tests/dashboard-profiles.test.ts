import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dashboardProfiles, getDashboardProfile, isModuleVisible } from "../packages/core/src/dashboard-profiles.js";
import { authorizeDashboardModule, visibleDashboardModules } from "../packages/core/src/dashboard-access.js";

const jean = { subjectId: "owner", role: "founder" as const, authenticated: true };
const child = { subjectId: "child", role: "child" as const, authenticated: true };

test("dashboard identifiers and modules remain distinct", () => {
  assert.equal(getDashboardProfile("founder").id, "dashboard-1");
  assert.equal(getDashboardProfile("child").id, "dashboard-2");
  assert.equal(isModuleVisible("child", "approvals"), false);
  assert.equal(isModuleVisible("child", "automation"), false);
  assert.equal(isModuleVisible("founder", "approvals"), true);
  assert.deepEqual(dashboardProfiles.child.modules, ["companion", "learning", "voice"]);
});

test("dashboard access fails closed for unauthenticated and cross-role requests", () => {
  assert.equal(authorizeDashboardModule(null, "founder", "approvals").allowed, false);
  assert.equal(authorizeDashboardModule({ ...jean, authenticated: false }, "founder", "approvals").allowed, false);
  assert.equal(authorizeDashboardModule(child, "founder", "approvals").reason, "wrong-role");
  assert.equal(authorizeDashboardModule(child, "child", "approvals").reason, "unknown-module");
  assert.deepEqual(visibleDashboardModules(child, "founder"), []);
  assert.deepEqual(visibleDashboardModules(jean, "child"), []);
  assert.deepEqual(visibleDashboardModules(child, "child"), ["companion", "learning", "voice"]);
});

test("avatar design remains reference-locked, not generated", () => {
  assert.equal(dashboardProfiles.founder.avatarAssetStatus, "approved-reference-required");
  assert.equal(dashboardProfiles.child.avatarAssetStatus, "approved-reference-required");
  assert.ok(dashboardProfiles.founder.avatarEmotions.includes("thinking"));
});
