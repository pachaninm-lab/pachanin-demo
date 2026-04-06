import { describe, it, expect } from 'vitest';
import {
  documentsByDeal,
  disputesByDeal,
  inventoryByDeal,
  labByDeal,
  lotById,
  paymentsByDeal,
  receivingByDeal,
  shipmentById,
  shipmentsByDeal,
} from './runtime-snapshot';

describe('runtime-snapshot helpers', () => {
  it('documentsByDeal возвращает только документы нужной сделки', () => {
    const docs = documentsByDeal('DEAL-001');
    expect(docs.every((d) => d.dealId === 'DEAL-001')).toBe(true);
    expect(documentsByDeal('DEAL-999')).toHaveLength(0);
  });

  it('disputesByDeal фильтрует по dealId', () => {
    const disputes = disputesByDeal('DEAL-002');
    expect(disputes.length).toBeGreaterThan(0);
    expect(disputes.every((d) => d.dealId === 'DEAL-002')).toBe(true);
    expect(disputesByDeal('DEAL-001')).toHaveLength(0);
  });

  it('inventoryByDeal возвращает партии', () => {
    const inv = inventoryByDeal('DEAL-001');
    expect(inv.length).toBeGreaterThan(0);
  });

  it('labByDeal возвращает пробы', () => {
    const labs = labByDeal('DEAL-001');
    expect(labs.length).toBeGreaterThan(0);
    expect(labs[0].dealId).toBe('DEAL-001');
  });

  it('lotById находит лот по id', () => {
    const lot = lotById('LOT-001');
    expect(lot).not.toBeNull();
    expect(lot?.id).toBe('LOT-001');
    expect(lotById('LOT-999')).toBeNull();
  });

  it('paymentsByDeal фильтрует платежи', () => {
    const payments = paymentsByDeal('DEAL-001');
    expect(payments.every((p) => p.dealId === 'DEAL-001')).toBe(true);
  });

  it('receivingByDeal фильтрует тикеты приёмки', () => {
    const tickets = receivingByDeal('DEAL-001');
    expect(tickets.every((t) => t.dealId === 'DEAL-001')).toBe(true);
  });

  it('shipmentById находит отгрузку', () => {
    const ship = shipmentById('SHIP-001');
    expect(ship).not.toBeNull();
    expect(ship?.id).toBe('SHIP-001');
    expect(shipmentById('SHIP-999')).toBeNull();
  });

  it('shipmentsByDeal фильтрует по dealId', () => {
    const ships = shipmentsByDeal('DEAL-001');
    expect(ships.every((s) => s.dealId === 'DEAL-001')).toBe(true);
    expect(shipmentsByDeal('DEAL-999')).toHaveLength(0);
  });
});
