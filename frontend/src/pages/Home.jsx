import Greetings from "../components/home/Greetings";
import MiniCard from "../components/home/MiniCard";
import PopularDishes from "../components/home/PopularDishes";
import RecentOrders from "../components/home/RecentOrders";
import BottomNav from "../components/shared/BottomNav";
import { BsCashCoin } from "react-icons/bs";
import { GrInProgress } from "react-icons/gr";
import { useOrderStats } from "../hooks/useOrderStats";
import { formatRupiah } from "../utils";

const Home = () => {
  const { stats, isLoading } = useOrderStats();

  return (
    <>
      <section className="bg-[#1f1f1f]">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 pb-20 lg:pb-8">
            {/* Left Section - Main Content */}
            <div className="flex-1 lg:flex-[3] w-full">
              <Greetings />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8">
                <MiniCard
                  title="Total Earnings"
                  icon={<BsCashCoin />}
                  number={formatRupiah(stats?.totalEarnings ?? 0)}
                  footerNum={isLoading ? undefined : stats?.earningsChange}
                />
                <MiniCard
                  title="In Progress"
                  icon={<GrInProgress />}
                  number={stats?.inProgress ?? 0}
                />
              </div>

              <RecentOrders />
            </div>

            {/* Right Section - Popular Dishes */}
            <div className="w-full lg:w-auto lg:flex-[2]">
              <PopularDishes />
            </div>
          </div>
        </div>
      </section>
      <BottomNav />
    </>
  );
};

export default Home;
