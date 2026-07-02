export function passkeysSupported() {
  return Boolean(
    window.isSecureContext
    && window.PublicKeyCredential
    && navigator.credentials,
  );
}

export function parseCreationOptions(publicKey) {
  if (typeof PublicKeyCredential.parseCreationOptionsFromJSON === "function") {
    return PublicKeyCredential.parseCreationOptionsFromJSON(publicKey);
  }
  return {
    ...publicKey,
    challenge: base64UrlToBytes(publicKey.challenge),
    user: {
      ...publicKey.user,
      id: base64UrlToBytes(publicKey.user.id),
    },
    excludeCredentials: (publicKey.excludeCredentials || []).map(parseDescriptor),
  };
}

export function parseRequestOptions(publicKey) {
  if (typeof PublicKeyCredential.parseRequestOptionsFromJSON === "function") {
    return PublicKeyCredential.parseRequestOptionsFromJSON(publicKey);
  }
  return {
    ...publicKey,
    challenge: base64UrlToBytes(publicKey.challenge),
    allowCredentials: (publicKey.allowCredentials || []).map(parseDescriptor),
  };
}

export function credentialToJson(credential) {
  if (typeof credential.toJSON === "function") {
    return credential.toJSON();
  }
  const response = credential.response;
  const result = {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment || undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
    },
  };
  if ("attestationObject" in response) {
    result.response.attestationObject = bytesToBase64Url(response.attestationObject);
    if (typeof response.getTransports === "function") {
      result.response.transports = response.getTransports();
    }
  } else {
    result.response.authenticatorData = bytesToBase64Url(response.authenticatorData);
    result.response.signature = bytesToBase64Url(response.signature);
    result.response.userHandle = response.userHandle ? bytesToBase64Url(response.userHandle) : null;
  }
  return result;
}

export function bytesToBase64Url(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value) {
  const base64 = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parseDescriptor(descriptor) {
  return { ...descriptor, id: base64UrlToBytes(descriptor.id) };
}
