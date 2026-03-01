import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction } from "express";
import { __resetAuthCachesForTests, isAuthenticated, setupAuth } from "../server/auth/supabaseAuth";
import { authStorage } from "../server/auth/storage";

type MockResponse = {
  statusCode: number;
  jsonBody: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
};

function createMockResponse(): MockResponse {
  return {
    statusCode: 200,
    jsonBody: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.jsonBody = payload;
      return this;
    },
  };
}

test("auth middleware signs in when LOCAL_DEV_AUTH is enabled", async (t) => {
  __resetAuthCachesForTests();
  const originalLocalDevAuth = process.env.LOCAL_DEV_AUTH;
  const originalLocalDevUserId = process.env.LOCAL_DEV_USER_ID;
  const originalUpsertUser = authStorage.upsertUser;

  t.after(() => {
    process.env.LOCAL_DEV_AUTH = originalLocalDevAuth;
    process.env.LOCAL_DEV_USER_ID = originalLocalDevUserId;
    authStorage.upsertUser = originalUpsertUser;
  });

  process.env.LOCAL_DEV_AUTH = "true";
  process.env.LOCAL_DEV_USER_ID = "test-local-user";
  authStorage.upsertUser = async (user) => ({
    id: user.id ?? "mock-user",
    email: user.email ?? null,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    profileImageUrl: user.profileImageUrl ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const req: any = {
    header: () => undefined,
  };
  const res = createMockResponse();
  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  await isAuthenticated(req, res as any, next);

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(req.user?.claims?.sub, "test-local-user");
});

test("auth middleware signs out/denies when no token is provided", async (t) => {
  __resetAuthCachesForTests();
  const originalLocalDevAuth = process.env.LOCAL_DEV_AUTH;
  t.after(() => {
    process.env.LOCAL_DEV_AUTH = originalLocalDevAuth;
  });

  process.env.LOCAL_DEV_AUTH = "false";

  const req: any = {
    header: () => undefined,
  };
  const res = createMockResponse();
  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  await isAuthenticated(req, res as any, next);

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { message: "Unauthorized" });
});

test("auth middleware does not upsert unchanged profile on repeated requests", async (t) => {
  __resetAuthCachesForTests();
  const originalLocalDevAuth = process.env.LOCAL_DEV_AUTH;
  const originalLocalDevUserId = process.env.LOCAL_DEV_USER_ID;
  const originalUpsertUser = authStorage.upsertUser;

  t.after(() => {
    process.env.LOCAL_DEV_AUTH = originalLocalDevAuth;
    process.env.LOCAL_DEV_USER_ID = originalLocalDevUserId;
    authStorage.upsertUser = originalUpsertUser;
  });

  process.env.LOCAL_DEV_AUTH = "true";
  process.env.LOCAL_DEV_USER_ID = "test-local-user-repeat";

  let upsertCalls = 0;
  authStorage.upsertUser = async (user) => {
    upsertCalls += 1;
    return {
      id: user.id ?? "mock-user",
      email: user.email ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      profileImageUrl: user.profileImageUrl ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  };

  const next: NextFunction = () => undefined;
  await isAuthenticated({ header: () => undefined } as any, createMockResponse() as any, next);
  await isAuthenticated({ header: () => undefined } as any, createMockResponse() as any, next);

  assert.equal(upsertCalls, 1);
});

test("auth setup rejects LOCAL_DEV_AUTH in production", async (t) => {
  __resetAuthCachesForTests();
  const originalLocalDevAuth = process.env.LOCAL_DEV_AUTH;
  const originalNodeEnv = process.env.NODE_ENV;

  t.after(() => {
    process.env.LOCAL_DEV_AUTH = originalLocalDevAuth;
    process.env.NODE_ENV = originalNodeEnv;
  });

  process.env.LOCAL_DEV_AUTH = "true";
  process.env.NODE_ENV = "production";

  await assert.rejects(() => setupAuth({} as any), /LOCAL_DEV_AUTH cannot be enabled/);
});
