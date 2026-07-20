/**
 * LogisticsFulfillmentService — farmer fleet routes for ACCEPTED B2B orders.
 * Telemetry: LOGISTICS_ENGINE_INITIALIZED, FLEET_TRACKING_ACTIVE
 */

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { PaymentClearingService } from '../financial/payment-clearing.service';
import {
  assignDropoffOrders,
  formatFleetTrackingActiveLog,
  formatLogisticsEngineInitializedLog,
} from './logistics.util';

@Injectable()
export class LogisticsFulfillmentService implements OnModuleInit {
  private readonly logger = new Logger(LogisticsFulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clearing: PaymentClearingService,
  ) {}

  onModuleInit(): void {
    this.logger.log(formatLogisticsEngineInitializedLog());
    this.logger.log(formatFleetTrackingActiveLog());
  }

  async resolveFarmerIdForUser(userId: string): Promise<string> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM public.farmers
      WHERE user_id = ${userId}::uuid
      LIMIT 1
    `);
    if (!rows[0]) throw new BadRequestException('FARMER_PROFILE_REQUIRED');
    return rows[0].id;
  }

  /**
   * Group multiple ACCEPTED wholesale procurement requests into one delivery route.
   * Holds wholesale escrow per stop via PaymentClearingService.
   */
  async createRouteFromAcceptedOrders(input: {
    farmerId: string;
    procurementRequestIds: string[];
    dispatchDate: string;
  }) {
    if (!input.farmerId?.trim()) {
      throw new BadRequestException('FARMER_ID_REQUIRED');
    }
    const ids = (input.procurementRequestIds ?? [])
      .map((id) => id?.trim())
      .filter(Boolean);
    if (ids.length < 1) {
      throw new BadRequestException('PROCUREMENT_REQUESTS_REQUIRED');
    }
    const dispatchDate = (input.dispatchDate ?? '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dispatchDate)) {
      throw new BadRequestException('DISPATCH_DATE_INVALID');
    }

    const uniqueIds = [...new Set(ids)];
    const orders = await this.prisma.$queryRaw<
      Array<{
        id: string;
        vendor_id: string;
        farmer_id: string;
        status: string;
        requested_quantity: number | string | null;
        bulk_unit_price: number | string | null;
        escrow_transaction_id: string | null;
      }>
    >(Prisma.sql`
      SELECT
        r.id,
        r.vendor_id,
        r.farmer_id,
        r.status,
        r.requested_quantity,
        r.escrow_transaction_id,
        l.bulk_unit_price
      FROM public.b2b_procurement_requests r
      LEFT JOIN public.wholesale_listings l ON l.id = r.listing_id
      WHERE r.id IN (${Prisma.join(
        uniqueIds.map((id) => Prisma.sql`${id}::uuid`),
      )})
    `);

    if (orders.length !== uniqueIds.length) {
      throw new NotFoundException('PROCUREMENT_REQUEST_NOT_FOUND');
    }
    for (const order of orders) {
      if (order.farmer_id !== input.farmerId) {
        throw new BadRequestException('FARMER_MISMATCH');
      }
      if (order.status !== 'ACCEPTED') {
        throw new BadRequestException('PROCUREMENT_NOT_ACCEPTED');
      }
    }

    const staged = assignDropoffOrders(
      orders.map((order) => ({
        procurementRequestId: order.id,
        vendorId: order.vendor_id,
        amountCents: this.resolveWholesaleAmountCents(order),
      })),
    );

    const routeRows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO public.delivery_routes (farmer_id, dispatch_date, status)
      VALUES (
        ${input.farmerId}::uuid,
        ${dispatchDate}::date,
        'SCHEDULED'::public.delivery_route_status
      )
      RETURNING id
    `);
    const routeId = routeRows[0]?.id;
    if (!routeId) throw new BadRequestException('ROUTE_CREATE_FAILED');

    const stops: Array<{
      id: string;
      procurementRequestId: string;
      vendorId: string;
      dropoffOrder: number;
      escrow: unknown;
    }> = [];

    for (const stop of staged) {
      const escrow = await this.clearing.holdWholesaleEscrow(
        stop.procurementRequestId,
        stop.amountCents,
      );

      const stopRows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        INSERT INTO public.delivery_stops (
          route_id, procurement_request_id, vendor_id, dropoff_order, status
        ) VALUES (
          ${routeId}::uuid,
          ${stop.procurementRequestId}::uuid,
          ${stop.vendorId}::uuid,
          ${stop.dropoffOrder},
          'PENDING'::public.delivery_stop_status
        )
        RETURNING id
      `);
      const stopId = stopRows[0]?.id;
      if (!stopId) throw new BadRequestException('STOP_CREATE_FAILED');

      stops.push({
        id: stopId,
        procurementRequestId: stop.procurementRequestId,
        vendorId: stop.vendorId,
        dropoffOrder: stop.dropoffOrder,
        escrow,
      });
    }

    this.logger.log(
      formatFleetTrackingActiveLog({
        routeId,
        status: 'SCHEDULED',
      }),
    );
    this.logger.log(
      `LOGISTICS_ENGINE_INITIALIZED ACTION=ROUTE_CREATED STOPS=${stops.length}`,
    );

    return {
      STATUS: 'LOGISTICS_ENGINE_INITIALIZED',
      ACTION: 'ROUTE_CREATED',
      ROUTE_ID: routeId,
      FARMER_ID: input.farmerId,
      DISPATCH_DATE: dispatchDate,
      ROUTE_STATUS: 'SCHEDULED',
      STOPS: stops.map((stop) => ({
        id: stop.id,
        procurementRequestId: stop.procurementRequestId,
        vendorId: stop.vendorId,
        dropoffOrder: stop.dropoffOrder,
        status: 'PENDING',
        escrow: stop.escrow,
      })),
      COUNT: stops.length,
    };
  }

  /**
   * Mark a stop DELIVERED and settle wholesale escrow into farmer available balance.
   */
  async confirmDropoff(stopId: string) {
    if (!stopId?.trim()) throw new BadRequestException('STOP_ID_REQUIRED');

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        route_id: string;
        procurement_request_id: string;
        vendor_id: string;
        status: string;
        farmer_id: string;
      }>
    >(Prisma.sql`
      SELECT
        s.id,
        s.route_id,
        s.procurement_request_id,
        s.vendor_id,
        s.status::text AS status,
        r.farmer_id
      FROM public.delivery_stops s
      JOIN public.delivery_routes r ON r.id = s.route_id
      WHERE s.id = ${stopId}::uuid
      LIMIT 1
    `);
    if (!rows[0]) throw new NotFoundException('STOP_NOT_FOUND');
    const stop = rows[0];
    if (stop.status === 'DELIVERED') {
      throw new BadRequestException('STOP_ALREADY_DELIVERED');
    }
    if (stop.status === 'FAILED') {
      throw new BadRequestException('STOP_FAILED');
    }

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.delivery_stops
      SET
        status = 'DELIVERED'::public.delivery_stop_status,
        delivered_at = NOW(),
        updated_at = NOW()
      WHERE id = ${stopId}::uuid
    `);

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public.delivery_routes
      SET
        status = 'IN_TRANSIT'::public.delivery_route_status,
        updated_at = NOW()
      WHERE id = ${stop.route_id}::uuid
        AND status = 'SCHEDULED'::public.delivery_route_status
    `);

    const settlement = await this.clearing.releaseEscrow({
      procurementRequestId: stop.procurement_request_id,
    });

    const remaining = await this.prisma.$queryRaw<Array<{ pending: number | string }>>(
      Prisma.sql`
        SELECT COUNT(*)::int AS pending
        FROM public.delivery_stops
        WHERE route_id = ${stop.route_id}::uuid
          AND status = 'PENDING'::public.delivery_stop_status
      `,
    );
    const pendingCount = Number(remaining[0]?.pending) || 0;
    let routeStatus = 'IN_TRANSIT';
    if (pendingCount === 0) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE public.delivery_routes
        SET
          status = 'COMPLETED'::public.delivery_route_status,
          updated_at = NOW()
        WHERE id = ${stop.route_id}::uuid
      `);
      routeStatus = 'COMPLETED';
    }

    this.logger.log(
      formatFleetTrackingActiveLog({
        routeId: stop.route_id,
        stopId,
        status: 'DELIVERED',
      }),
    );

    return {
      STATUS: 'FLEET_TRACKING_ACTIVE',
      ACTION: 'DROPOFF_CONFIRMED',
      STOP_ID: stopId,
      ROUTE_ID: stop.route_id,
      PROCUREMENT_REQUEST_ID: stop.procurement_request_id,
      VENDOR_ID: stop.vendor_id,
      FARMER_ID: stop.farmer_id,
      STOP_STATUS: 'DELIVERED',
      ROUTE_STATUS: routeStatus,
      SETTLEMENT: settlement,
    };
  }

  async listRoutesForFarmer(farmerId: string, limit = 20) {
    if (!farmerId?.trim()) throw new BadRequestException('FARMER_ID_REQUIRED');
    const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));

    const routes = await this.prisma.$queryRaw<
      Array<{
        id: string;
        dispatch_date: Date | string;
        status: string;
        created_at: Date;
      }>
    >(Prisma.sql`
      SELECT id, dispatch_date, status::text AS status, created_at
      FROM public.delivery_routes
      WHERE farmer_id = ${farmerId}::uuid
      ORDER BY dispatch_date DESC, created_at DESC
      LIMIT ${safeLimit}
    `);

    const items = [];
    for (const route of routes) {
      const stops = await this.prisma.$queryRaw<
        Array<{
          id: string;
          procurement_request_id: string;
          vendor_id: string;
          dropoff_order: number;
          status: string;
          escrow_transaction_id: string | null;
        }>
      >(Prisma.sql`
        SELECT
          s.id,
          s.procurement_request_id,
          s.vendor_id,
          s.dropoff_order,
          s.status::text AS status,
          r.escrow_transaction_id
        FROM public.delivery_stops s
        JOIN public.b2b_procurement_requests r
          ON r.id = s.procurement_request_id
        WHERE s.route_id = ${route.id}::uuid
        ORDER BY s.dropoff_order ASC
      `);
      items.push({
        id: route.id,
        dispatchDate: String(route.dispatch_date).slice(0, 10),
        status: route.status,
        createdAt: route.created_at,
        stops: stops.map((stop) => ({
          id: stop.id,
          procurementRequestId: stop.procurement_request_id,
          vendorId: stop.vendor_id,
          dropoffOrder: stop.dropoff_order,
          status: stop.status,
          escrowTransactionId: stop.escrow_transaction_id,
        })),
      });
    }

    this.logger.log(
      formatFleetTrackingActiveLog({ status: `ROUTES=${items.length}` }),
    );

    return {
      STATUS: 'FLEET_TRACKING_ACTIVE',
      ITEMS: items,
      COUNT: items.length,
    };
  }

  private resolveWholesaleAmountCents(order: {
    requested_quantity: number | string | null;
    bulk_unit_price: number | string | null;
  }): number {
    const qty =
      order.requested_quantity != null ? Number(order.requested_quantity) : 1;
    const unit =
      order.bulk_unit_price != null
        ? Math.round(Number(order.bulk_unit_price) * 100)
        : 0;
    const amount = Math.max(0, Math.floor(qty * unit));
    if (amount < 1) {
      // Fallback minimum hold so escrow can settle when listing price is missing.
      return 100;
    }
    return amount;
  }
}
