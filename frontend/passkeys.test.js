import test from "node:test";
import assert from "node:assert/strict";

import {
  base64UrlToBytes,
  bytesToBase64Url,
  credentialToJson,
} from "./passkeys.js";

globalThis.btoa ??= (value) => Buffer.from(value, "binary").toString("base64");
globalThis.atob ??= (value) => Buffer.from(value, "base64").toString("binary");

test("passkey binary values use unpadded base64url", () => {
  const bytes = Uint8Array.from([0xfb, 0xff, 0x00, 0x2a]);
  const encoded = bytesToBase64Url(bytes);

  assert.equal(encoded, "-_8AKg");
  assert.deepEqual(base64UrlToBytes(encoded), bytes);
});

test("credential fallback JSON contains WebAuthn assertion fields", () => {
  const credential = {
    id: "credential",
    rawId: Uint8Array.from([1, 2, 3]),
    type: "public-key",
    authenticatorAttachment: "platform",
    getClientExtensionResults: () => ({}),
    response: {
      clientDataJSON: Uint8Array.from([4]),
      authenticatorData: Uint8Array.from([5]),
      signature: Uint8Array.from([6]),
      userHandle: Uint8Array.from([7]),
    },
  };

  assert.deepEqual(credentialToJson(credential), {
    id: "credential",
    rawId: "AQID",
    type: "public-key",
    authenticatorAttachment: "platform",
    clientExtensionResults: {},
    response: {
      clientDataJSON: "BA",
      authenticatorData: "BQ",
      signature: "Bg",
      userHandle: "Bw",
    },
  });
});

test("credential fallback JSON contains WebAuthn registration fields", () => {
  const credential = {
    id: "credential",
    rawId: Uint8Array.from([1]),
    type: "public-key",
    authenticatorAttachment: null,
    getClientExtensionResults: () => ({ credProps: { rk: true } }),
    response: {
      clientDataJSON: Uint8Array.from([2]),
      attestationObject: Uint8Array.from([3]),
      getTransports: () => ["internal", "hybrid"],
    },
  };

  assert.deepEqual(credentialToJson(credential), {
    id: "credential",
    rawId: "AQ",
    type: "public-key",
    authenticatorAttachment: undefined,
    clientExtensionResults: { credProps: { rk: true } },
    response: {
      clientDataJSON: "Ag",
      attestationObject: "Aw",
      transports: ["internal", "hybrid"],
    },
  });
});
