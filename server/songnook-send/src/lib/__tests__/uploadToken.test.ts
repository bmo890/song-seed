import { test } from "node:test";
import assert from "node:assert/strict";
import { hashUploadToken, uploadTokenValid } from "../uploadToken.ts";

const fakeContext = (headers: Record<string, string> = {}) =>
  ({
    req: {
      header(name: string) {
        return headers[name.toLowerCase()];
      },
    },
  }) as any;

test("upload token hashes are stable and not the raw token", async () => {
  const hash = await hashUploadToken("ut_secret");
  assert.match(hash, /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(hash, "ut_secret");
  assert.equal(hash, await hashUploadToken("ut_secret"));
});

test("new transfers require the matching upload token", async () => {
  const transfer = { upload_token_hash: await hashUploadToken("ut_secret") } as any;

  assert.equal(
    await uploadTokenValid(fakeContext(), transfer, { uploadToken: "ut_secret" }),
    true
  );
  assert.equal(
    await uploadTokenValid(fakeContext({ "x-upload-token": "ut_secret" }), transfer, {}),
    true
  );
  assert.equal(
    await uploadTokenValid(fakeContext({ authorization: "Bearer ut_secret" }), transfer, {}),
    true
  );
  assert.equal(
    await uploadTokenValid(fakeContext(), transfer, { uploadToken: "wrong" }),
    false
  );
  assert.equal(await uploadTokenValid(fakeContext(), transfer, {}), false);
});

test("legacy draft rows without a token hash remain finishable", async () => {
  assert.equal(await uploadTokenValid(fakeContext(), { upload_token_hash: null } as any, {}), true);
});
