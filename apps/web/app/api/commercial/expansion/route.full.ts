import { getCommercialExpansionReadModel } from '../../../../lib/commercial-expansion-server';

export async function GET() {
  const payload = await getCommercialExpansionReadModel();
  return Response.json(payload);
}
