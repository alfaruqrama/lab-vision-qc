
import { describe, it, expect } from 'vitest';
import { checkLotExpiry } from '../lot-expiry';

describe('lot-expiry', () => {
  it('should return expired when date is past expiry', () => {
    const pastDate = '2020-01-01';
    const result = checkLotExpiry(pastDate);
    expect(result.status).toBe('expired');
  });

  it('should return expiring-soon when date is within 30 days', () => {
    const today = new Date();
    const nearFuture = new Date();
    nearFuture.setDate(today.getDate() + 10);
    const dateStr = nearFuture.toISOString().slice(0, 10);
    
    const result = checkLotExpiry(dateStr);
    expect(result.status).toBe('expiring-soon');
  });

  it('should return ok when date is far in future', () => {
    const farFuture = '2099-12-31';
    const result = checkLotExpiry(farFuture);
    expect(result.status).toBe('ok');
  });
});
