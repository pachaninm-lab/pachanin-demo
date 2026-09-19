import { EntityId, IsoDateTime } from './core-types';

export interface DealFingerprint {
  id: EntityId;
  sellerId: EntityId;
  buyerId: EntityId;
  crop: string;
  cropClass: string;
  volumeRange: string;
  region: string;
  basis: string;
  priceRange: string;
  deliveryWindow: string;
  qualityHash: string;
  documentHash: string;
  createdAt: IsoDateTime;
}

export interface DealFingerprintInput {
  sellerId: EntityId;
  buyerId: EntityId;
  crop: string;
  cropClass?: string;
  volumeTons: number;
  region: string;
  basis: string;
  pricePerTon: number;
  deliveryWindow: string;
  qualityHash: string;
  documentHash: string;
}

function bucket(value: number, step: number): string {
  const low = Math.floor(value / step) * step;
  return `${low}-${low + step}`;
}

function simpleHash(parts: string[]): string {
  let hash = 0;
  const source = parts.join('|');
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function createDealFingerprint(input: DealFingerprintInput): DealFingerprint {
  const volumeRange = bucket(input.volumeTons, 100);
  const priceRange = bucket(input.pricePerTon, 250);
  const id = `DF-${simpleHash([input.sellerId, input.buyerId, input.crop, input.cropClass ?? '', volumeRange, input.region, input.basis, priceRange, input.deliveryWindow, input.qualityHash, input.documentHash])}`;
  return {
    id,
    sellerId: input.sellerId,
    buyerId: input.buyerId,
    crop: input.crop,
    cropClass: input.cropClass ?? 'unknown',
    volumeRange,
    region: input.region,
    basis: input.basis,
    priceRange,
    deliveryWindow: input.deliveryWindow,
    qualityHash: input.qualityHash,
    documentHash: input.documentHash,
    createdAt: new Date().toISOString(),
  };
}

export function isSimilarDealFingerprint(left: DealFingerprint, right: DealFingerprint): boolean {
  return left.sellerId === right.sellerId &&
    left.buyerId === right.buyerId &&
    left.crop === right.crop &&
    left.cropClass === right.cropClass &&
    left.volumeRange === right.volumeRange &&
    left.region === right.region &&
    left.basis === right.basis &&
    left.priceRange === right.priceRange;
}
