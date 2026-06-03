/** Browser-safe URL; actual bytes are served by GET /api/receipts/:id */
export function receiptViewUrl(receiptId: string): string {
  return `/api/receipts/${receiptId}`;
}
