import { useCachedPromise } from "@raycast/utils";
import { getAccessToken } from "../oauth";

const API_BASE_URL = "https://api.ouraring.com/v2/";

export function oura<T>(route: string) {
  const { isLoading, data, revalidate, error } = useCachedPromise(async () => {
    const accessToken = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}${route}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || response.statusText);
    }

    return (await response.json()) as T;
  }, [route]);

  return { isLoading, data, revalidate, error };
}
