import { Response } from 'express';

const supplierWarehouseClients = new Map<number, Set<Response>>();

export function addSupplierWarehouseClient(supplierId: number, res: Response) {
  if (!supplierWarehouseClients.has(supplierId)) {
    supplierWarehouseClients.set(supplierId, new Set());
  }

  supplierWarehouseClients.get(supplierId)!.add(res);

  res.on('close', () => {
    supplierWarehouseClients.get(supplierId)?.delete(res);

    if (supplierWarehouseClients.get(supplierId)?.size === 0) {
      supplierWarehouseClients.delete(supplierId);
    }
  });
}

export function notifySupplierWarehouseUpdated(supplierId: number, payload: any = {}) {
  const clients = supplierWarehouseClients.get(supplierId);

  if (!clients || clients.size === 0) {
    return;
  }

  const message = `data: ${JSON.stringify({
    type: 'warehouse-updated',
    supplierId,
    createdAt: new Date().toISOString(),
    ...payload
  })}\n\n`;

  clients.forEach((res) => {
    try {
      res.write(message);
    } catch {
      clients.delete(res);
    }
  });
}