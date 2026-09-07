import { getCommercialExpansionReadModel } from '../../../../lib/commercial-expansion-server';
import { jsonNoStore } from '../../../../lib/http/no-store';

export async function GET() {
  const data = await getCommercialExpansionReadModel();
  return jsonNoStore(data);
}
