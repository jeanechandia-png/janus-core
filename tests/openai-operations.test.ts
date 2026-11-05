import { test } from "node:test";
import { strict as assert } from "node:assert";
import { authorizeOpenAIChat, openAIManagementCapabilities, type OpenAIUsagePolicy } from "../packages/core/src/openai-operations.js";
const policy: OpenAIUsagePolicy = {
  enabled:true, model:"configured-model", maxInputCharacters:1000, maxOutputTokens:1000,
  dailyRequestLimit:20, estimatedDailyUsdLimit:2,
  allowAutomaticModelChanges:false, allowBillingChanges:false,
};
test("valid chat passes preflight, not billing verification", () => {
  const result = authorizeOpenAIChat(policy,{requestsToday:0,estimatedSpendTodayUsd:0},"Hola");
  assert.equal(result.allowed,true);
  assert.match(result.reason,/unverified/);
});
test("limits fail closed", () => {
  assert.equal(authorizeOpenAIChat(policy,{requestsToday:20,estimatedSpendTodayUsd:0},"Hola").allowed,false);
  assert.equal(authorizeOpenAIChat(policy,{requestsToday:0,estimatedSpendTodayUsd:2},"Hola").allowed,false);
  assert.equal(authorizeOpenAIChat(policy,{requestsToday:0,estimatedSpendTodayUsd:NaN},"Hola").allowed,false);
  assert.equal(authorizeOpenAIChat(policy,{requestsToday:0,estimatedSpendTodayUsd:0},"x".repeat(1001)).allowed,false);
});
test("billing and secret access are never authorized", () => {
  assert.equal(openAIManagementCapabilities.accountBillingChanges,false);
  assert.equal(openAIManagementCapabilities.apiKeyDisclosure,false);
});
