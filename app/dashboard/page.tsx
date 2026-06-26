import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { fetchTxLineDashboardFixtures } from "@/lib/txline-fixtures";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const fixtures = await fetchTxLineDashboardFixtures();

  return <DashboardContent fixtures={fixtures} />;
}
