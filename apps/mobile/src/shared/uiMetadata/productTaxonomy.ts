const PRODUCT_LIBRARY_NAMES = new Set([
  '听力',
  '仔细阅读',
  '选词填空',
  '写作',
  '翻译',
  '词汇',
  '语法',
]);

export function isProductLibraryName(value: string) {
  return PRODUCT_LIBRARY_NAMES.has(value);
}
