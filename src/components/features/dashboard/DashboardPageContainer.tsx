import { useDashboardQuery } from "@/hooks/queries";
import DashboardActions from "./DashboardActions";
import DashboardHero from "./DashboardHero";
import DashboardRecentTasks from "./DashboardRecentTasks";
import DashboardStats from "./DashboardStats";

const DashboardPageContainer = () => {
  const { data, isLoading, isError } = useDashboardQuery();

  return (
    <div className="space-y-8 pb-8">
      <DashboardHero />
      <DashboardStats isLoading={isLoading} stats={data?.stats ?? []} />
      <section className="grid min-w-0 gap-6 xl:grid-cols-[1.1fr_0.9fr] [&>*]:min-w-0">
        <DashboardActions />
        <DashboardRecentTasks isError={isError} isLoading={isLoading} recentTasks={data?.recentTasks ?? []} />
      </section>
    </div>
  );
};

export default DashboardPageContainer;
