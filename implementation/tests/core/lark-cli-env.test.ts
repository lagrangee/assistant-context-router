import assert from "node:assert/strict";
import os from "node:os";
import test from "node:test";

import { buildNormalizedLarkCliEnv } from "../../adapters/work-surfaces/feishu/src/lark-cli-env.ts";

test("buildNormalizedLarkCliEnv fills HOME and user identity defaults", () => {
  const env = buildNormalizedLarkCliEnv({
    HOME: "",
    USER: "",
    LOGNAME: "",
    SHELL: "",
  });

  assert.equal(env.HOME, os.homedir());
  assert.ok(typeof env.USER === "string" && env.USER.length > 0);
  assert.ok(typeof env.LOGNAME === "string" && env.LOGNAME.length > 0);
});

test("buildNormalizedLarkCliEnv preserves explicit overrides", () => {
  const env = buildNormalizedLarkCliEnv({
    HOME: "/tmp/acr-home",
    USER: "acr-user",
    LOGNAME: "acr-logname",
    SHELL: "/bin/bash",
    PATH: "/tmp/bin",
  });

  assert.equal(env.HOME, "/tmp/acr-home");
  assert.equal(env.USER, "acr-user");
  assert.equal(env.LOGNAME, "acr-logname");
  assert.equal(env.SHELL, "/bin/bash");
  assert.equal(env.PATH, "/tmp/bin");
});

test("buildNormalizedLarkCliEnv does not implicitly merge process env when overrides are provided", () => {
  const env = buildNormalizedLarkCliEnv({
    HOME: "/tmp/acr-home",
    USER: "acr-user",
    LOGNAME: "acr-logname",
  });

  assert.equal(env.HOME, "/tmp/acr-home");
  assert.equal(env.USER, "acr-user");
  assert.equal(env.LOGNAME, "acr-logname");
  assert.equal(env.PATH, undefined);
});
