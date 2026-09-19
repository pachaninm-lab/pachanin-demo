import { writeStructuredLog } from '../../apps/api/src/common/logging/structured-logger';

const CONNECTORS = ['EDO', 'FGIS_ZERNO', 'BANK', 'GPS', 'LAB'];

export async function runConnectorRetryWorker() {
  for (const connector of CONNECTORS) {
    writeStructuredLog({
      source: 'worker.connector-retry',
      message: 'Connector retry check scheduled',
      eventType: 'connector.retry.check',
      objectType: 'connector',
      objectId: connector.toLowerCase(),
      data: { connector }
    });
  }
}
