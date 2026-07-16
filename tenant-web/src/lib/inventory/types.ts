export interface InventoryProductRow {
  id: string;
  name: string;
  price: number;
  media_urls: string[];
  category: string | null;
  status: string;
  totalStock: number;
  preOrder: number;
  walkUp: number;
}

export interface InventoryEventRow {
  id: string;
  name: string;
  start_datetime: string;
}

export interface InventoryAvailabilityRow {
  product_id: string;
  event_id: string;
  available_quantity_presale: number;
  available_quantity_inperson: number;
}

export interface InventoryApiResponse {
  products: InventoryProductRow[];
  events: InventoryEventRow[];
  availability: InventoryAvailabilityRow[];
}

export interface InventorySaveBody {
  vendorId: string;
  productId: string;
  eventId: string;
  totalStock: number;
  preOrderPercent: number;
}
