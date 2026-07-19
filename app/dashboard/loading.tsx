import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function DashboardLoading() {
  return <PageSkeleton label="Loading fixtures" cards={4} />;
}
