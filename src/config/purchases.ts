import { Platform } from 'react-native';
import Constants from 'expo-constants';
import Purchases, { PRODUCT_CATEGORY, PurchasesStoreProduct, SubscriptionOption } from 'react-native-purchases';

const apiKey: string = Constants.expoConfig?.extra?.revenuecatAndroidKey ?? '';
let configured = false;

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'failed';

export const purchasesAvailable = (): boolean => Platform.OS === 'android' && !!apiKey;

export const identifyPurchaser = (uid: string | null) => {
  if (!purchasesAvailable()) return;
  try {
    if (!configured) {
      Purchases.configure({ apiKey, appUserID: uid ?? undefined });
      configured = true;
      return;
    }
    if (uid) Purchases.logIn(uid).catch(() => {});
    else Purchases.logOut().catch(() => {});
  } catch {}
};

const baseId = (product: PurchasesStoreProduct) => product.identifier.split(':')[0];

export const loadProducts = async (productIds: string[]): Promise<Record<string, PurchasesStoreProduct>> => {
  if (!purchasesAvailable() || !configured) return {};
  const oneTime = productIds.filter((id) => id.includes('lifetime'));
  const subscriptions = productIds.filter((id) => !id.includes('lifetime'));
  try {
    const [subs, once] = await Promise.all([
      subscriptions.length ? Purchases.getProducts(subscriptions, PRODUCT_CATEGORY.SUBSCRIPTION) : [],
      oneTime.length ? Purchases.getProducts(oneTime, PRODUCT_CATEGORY.NON_SUBSCRIPTION) : [],
    ]);
    const map: Record<string, PurchasesStoreProduct> = {};
    for (const p of [...subs, ...once]) {
      if (!map[baseId(p)]) map[baseId(p)] = p;
    }
    return map;
  } catch {
    return {};
  }
};

export const WELCOME_OFFER_TAG = 'welcome';

const optionFor = (product: PurchasesStoreProduct, offerTag?: string): SubscriptionOption | null => {
  const options = product.subscriptionOptions ?? [];
  if (!options.length) return null;
  const tagged = offerTag ? options.find((o) => o.tags.includes(offerTag)) : undefined;
  return tagged ?? options.find((o) => o.isBasePlan) ?? null;
};

export const priceOf = (product: PurchasesStoreProduct, offerTag?: string): string => {
  const option = optionFor(product, offerTag);
  if (!option) return product.priceString;
  return (option.introPhase ?? option.fullPricePhase)?.price.formatted ?? product.priceString;
};

export const buyProduct = async (product: PurchasesStoreProduct, offerTag?: string): Promise<PurchaseOutcome> => {
  try {
    const option = optionFor(product, offerTag);
    if (option) await Purchases.purchaseSubscriptionOption(option);
    else await Purchases.purchaseStoreProduct(product);
    return 'purchased';
  } catch (e: any) {
    return e?.userCancelled ? 'cancelled' : 'failed';
  }
};

export const restorePurchases = async (): Promise<boolean> => {
  if (!purchasesAvailable() || !configured) return false;
  try {
    await Purchases.restorePurchases();
    return true;
  } catch {
    return false;
  }
};

export const MANAGE_SUBSCRIPTIONS_URL =
  'https://play.google.com/store/account/subscriptions?package=com.palelastudio.ironmind';
