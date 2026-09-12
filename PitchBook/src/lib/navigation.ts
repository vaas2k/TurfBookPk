import { Href, router } from 'expo-router';

/** Returns to the previous screen when one exists, otherwise opens a safe primary destination. */
export function goBackOrReplace(fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
