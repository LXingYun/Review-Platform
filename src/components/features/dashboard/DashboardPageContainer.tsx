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
      <DashboardActions />
      <DashboardRecentTasks isError={isError} isLoading={isLoading} recentTasks={data?.recentTasks ?? []} />
    </div>
  );
};

export default DashboardPageContainer;
