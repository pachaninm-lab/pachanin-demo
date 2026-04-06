/** 
 * Обработчики действий водителя — все замкнуты на API.
 * Работают в offline через queueOfflineAction.
 */
import { api } from './api-client';
import { queueOfflineAction, isOnline } from './offline';
import { applyCsrfHeader } from './csrf';

export async function acceptTrip(shipmentId: string): Promise<void> {
  await api.patch(`/logistics/shipments/${shipmentId}/transition`, { nextState: 'DRIVER_CONFIRMED' });
}

export async function submitCheckpoint(shipmentId: string, type: string): Promise<void> {
  const pos = await getCurrentPosition();
  await api.post(`/logistics/shipments/${shipmentId}/checkpoints`, {
    type, lat: pos.lat, lng: pos.lng, timestamp: new Date().toISOString(),
  });
}

export async function verifyPin(shipmentId: string, pin: string): Promise<boolean> {
  const res = await api.post<{ valid: boolean }>(`/logistics/shipments/${shipmentId}/verify-pin`, { pin });
  return res.valid;
}

export async function uploadEvidence(shipmentId: string, file: File, type: string): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('shipmentId', shipmentId);
  formData.append('type', type);
  
  if (!isOnline()) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      queueOfflineAction({
        url: `/evidence/upload`, method: 'POST', shipmentId, type, fileName: file.name, dataUrl: reader.result,
      });
    };
    return;
  }
  
  await fetch('/api/proxy/evidence/upload', { method: 'POST', headers: applyCsrfHeader(), body: formData });
}

export async function reportIncident(shipmentId: string, description: string, linkedDealId?: string): Promise<void> {
  await api.post(`/support/tickets`, {
    title: `Инцидент на рейсе ${shipmentId}`,
    description,
    priority: 'HIGH',
    linkedDealId,
  });
}

function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({ lat: 52.7317, lng: 41.4433 }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: 52.7317, lng: 41.4433 }),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}
