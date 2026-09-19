import { getCommercialExpansionReadModel } from '../../../../lib/commercial-expansion-server';

export async function GET() {
  const data = await getCommercialExpansionReadModel();
  return Response.json(data);
}
