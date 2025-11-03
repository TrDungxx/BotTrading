export async function copyPrice(price?: number | null): Promise<boolean> {
  if (price == null || !Number.isFinite(price)) return false;
  try {
    await navigator.clipboard.writeText(
      price.toLocaleString(undefined, { maximumFractionDigits: 8 })
    );
    return true;
  } catch {
    return false;
  }
}
