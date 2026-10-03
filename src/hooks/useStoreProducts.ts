import { useEffect, useState } from 'react';
import { PurchasesStoreProduct } from 'react-native-purchases';
import { loadProducts, priceOf } from '../config/purchases';
import { ProPlan } from '../constants/pro';

export const useStoreProducts = (plans: ProPlan[], active: boolean, offerTag?: string) => {
  const [products, setProducts] = useState<Record<string, PurchasesStoreProduct>>({});
  const key = plans.map((p) => p.productId).join(',');

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    loadProducts(plans.map((p) => p.productId)).then((map) => {
      if (!cancelled) setProducts(map);
    });
    return () => {
      cancelled = true;
    };
  }, [key, active]);

  const productFor = (plan: ProPlan): PurchasesStoreProduct | undefined => products[plan.productId];

  const priceFor = (plan: ProPlan): string => {
    const product = productFor(plan);
    return product ? priceOf(product, offerTag) : plan.price;
  };

  return { priceFor, productFor };
};
