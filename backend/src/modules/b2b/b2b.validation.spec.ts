import {
  parseVendorConnectionRequest,
  parseWholesaleInvoiceReconcile,
  parseWholesaleOrderDraftCreate,
  parseWholesaleOrderFulfillment,
  parseWholesaleOrderSettlement,
  parseWholesaleProductCreate,
} from '@vendorly/env-config';

describe('b2b zod contracts', () => {
  it('accepts a valid connection request', () => {
    const parsed = parseVendorConnectionRequest({
      receiverVendorId: '11111111-1111-4111-8111-111111111111',
    });
    expect(parsed.OK).toBe(true);
  });

  it('rejects self-shaped invalid uuid', () => {
    const parsed = parseVendorConnectionRequest({ receiverVendorId: 'nope' });
    expect(parsed.OK).toBe(false);
  });

  it('accepts a wholesale SKU with fractional weight and tiers', () => {
    const parsed = parseWholesaleProductCreate({
      name: 'Heirloom Tomato Case',
      packagingUnit: 'case',
      weightLbs: 22.5,
      moq: 4,
      unitPriceCents: 4800,
      pricingTiers: [{ minQty: 10, unitPriceCents: 4200 }],
      freightNotes: 'Pallet freight available',
      pickupNotes: 'Dock 2 before 10:00',
    });
    expect(parsed.OK).toBe(true);
    if (!parsed.OK) return;
    expect(parsed.DATA.packagingUnit).toBe('CASE');
    expect(parsed.DATA.weightLbs).toBe(22.5);
  });

  it('rejects non-positive weight', () => {
    const parsed = parseWholesaleProductCreate({
      name: 'Bad',
      packagingUnit: 'LB',
      weightLbs: 0,
      moq: 1,
      unitPriceCents: 100,
    });
    expect(parsed.OK).toBe(false);
  });

  it('accepts a wholesale order draft payload', () => {
    const parsed = parseWholesaleOrderDraftCreate({
      buyer_vendor_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      seller_vendor_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      items: [
        {
          product_sku_id: '11111111-1111-4111-8111-111111111111',
          quantity: 50,
          negotiated_tier_unit_price: 2200,
        },
      ],
    });
    expect(parsed.OK).toBe(true);
  });

  it('rejects buyer equal to seller on draft payload', () => {
    const parsed = parseWholesaleOrderDraftCreate({
      buyer_vendor_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      seller_vendor_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      items: [
        {
          product_sku_id: '11111111-1111-4111-8111-111111111111',
          quantity: 1,
          negotiated_tier_unit_price: 100,
        },
      ],
    });
    expect(parsed.OK).toBe(false);
  });

  it('accepts a fulfillment logistics manifest', () => {
    const parsed = parseWholesaleOrderFulfillment({
      order_id: '33333333-3333-4333-8333-333333333333',
      carrier_name: 'FedEx',
      tracking_number: '1Z999AA10123456784',
      estimated_delivery_at: '2026-07-25T18:00:00.000Z',
    });
    expect(parsed.OK).toBe(true);
  });

  it('rejects fulfillment without tracking number', () => {
    const parsed = parseWholesaleOrderFulfillment({
      order_id: '33333333-3333-4333-8333-333333333333',
      carrier_name: 'UPS',
      tracking_number: '',
      estimated_delivery_at: '2026-07-25T18:00:00.000Z',
    });
    expect(parsed.OK).toBe(false);
  });

  it('accepts a delivery settlement payload', () => {
    const parsed = parseWholesaleOrderSettlement({
      order_id: '33333333-3333-4333-8333-333333333333',
      delivered_at: '2026-07-26T15:30:00.000Z',
    });
    expect(parsed.OK).toBe(true);
  });

  it('rejects settlement without delivered_at', () => {
    const parsed = parseWholesaleOrderSettlement({
      order_id: '33333333-3333-4333-8333-333333333333',
      delivered_at: '',
    });
    expect(parsed.OK).toBe(false);
  });

  it('accepts an invoice reconcile payload', () => {
    const parsed = parseWholesaleInvoiceReconcile({
      invoice_id: '44444444-4444-4444-8444-444444444444',
      paid_at: '2026-08-20T12:00:00.000Z',
    });
    expect(parsed.OK).toBe(true);
  });

  it('rejects reconcile without invoice_id', () => {
    const parsed = parseWholesaleInvoiceReconcile({
      invoice_id: 'nope',
    });
    expect(parsed.OK).toBe(false);
  });
});
