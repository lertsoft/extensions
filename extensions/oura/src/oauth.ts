import { OAuth, getPreferenceValues } from "@raycast/api";
import { Preference } from "./types";

const AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
const TOKEN_URL = "https://api.ouraring.com/oauth/token";
const SCOPES = "email personal daily heartrate tag workout session spo2 ring_configuration stress heart_health";

const client = new OAuth.PKCEClient({
  redirectMethod: OAuth.RedirectMethod.Web,
  providerName: "Oura",
  providerIcon: "command-icon.png",
  description: "Connect your Oura account to read your data.",
});

function getPreferences(): Preference {
  const preferences = getPreferenceValues<Preference>();
  if (!preferences.client_id || !preferences.client_secret) {
    throw new Error("Missing Oura client credentials. Please set them in preferences.");
  }
  return preferences;
}

export async function getAccessToken(): Promise<string> {
  await authorize();
  const tokenSet = await client.getTokens();
  if (!tokenSet?.accessToken) {
    throw new Error("Missing access token. Please re-authenticate.");
  }
  return tokenSet.accessToken;
}

async function authorize(): Promise<void> {
  const tokenSet = await client.getTokens();
  if (tokenSet?.accessToken) {
    if (tokenSet.refreshToken && tokenSet.isExpired()) {
      await client.setTokens(await refreshTokens(tokenSet.refreshToken));
    }
    return;
  }

  const preferences = getPreferences();
  const authRequest = await client.authorizationRequest({
    endpoint: AUTHORIZE_URL,
    clientId: preferences.client_id,
    scope: SCOPES,
  });

  const { authorizationCode } = await client.authorize(authRequest);
  await client.setTokens(await fetchTokens(authRequest, authorizationCode));
}

async function fetchTokens(authRequest: OAuth.AuthorizationRequest, authCode: string): Promise<OAuth.TokenResponse> {
  const preferences = getPreferences();
  const params = new URLSearchParams();

  params.append("client_id", preferences.client_id.trim());
  params.append("client_secret", preferences.client_secret.trim());
  params.append("code", authCode);
  params.append("grant_type", "authorization_code");
  params.append("redirect_uri", authRequest.redirectURI);
  params.append("code_verifier", authRequest.codeVerifier);
  params.append("scope", SCOPES);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    body: params,
  });

  if (!response.ok) {
    console.error("fetch tokens error:", await response.text());
    throw new Error(response.statusText);
  }

  return (await response.json()) as OAuth.TokenResponse;
}

async function refreshTokens(refreshToken: string): Promise<OAuth.TokenResponse> {
  const preferences = getPreferences();
  const params = new URLSearchParams();

  params.append("client_id", preferences.client_id.trim());
  params.append("client_secret", preferences.client_secret.trim());
  params.append("refresh_token", refreshToken.trim());
  params.append("grant_type", "refresh_token");
  params.append("scope", SCOPES);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    body: params,
  });

  if (!response.ok) {
    console.error("refresh tokens error:", await response.text());
    throw new Error(response.statusText);
  }

  const tokenResponse = (await response.json()) as OAuth.TokenResponse;
  tokenResponse.refresh_token = tokenResponse.refresh_token ?? refreshToken;
  return tokenResponse;
}
