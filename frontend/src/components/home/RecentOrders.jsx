import { useEffect, useState } from "react";
import { CiSearch } from "react-icons/ci";
import OrderList from "./OrderList";
import { useOrderDetail } from "../../hooks/useOrderDetail";
import { useDebounce } from "../../hooks/useDebounce";
import { useSearchParams } from "react-router-dom";

const RecentOrders = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlSearch = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(urlSearch);

  const debouncedSearchTerm = useDebounce(searchInput, 400);

  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    if (debouncedSearchTerm !== urlSearch) {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (debouncedSearchTerm) {
            params.set("search", debouncedSearchTerm);
          } else {
            params.delete("search");
          }
          return params;
        },
        { replace: true }
      );
    }
  }, [debouncedSearchTerm]);

  const { orders, isLoading } = useOrderDetail({
    search: debouncedSearchTerm,
  });

  return (
    <div className="px-8 mt-8">
      <div className=" bg-[#1a1a1a] w-full h-[450px] rounded-lg">
        <div className="flex justify-between items-center px-6 py-4">
          <h1 className="text-2xl font-poppins font-bold text-white tracking-wide">
            Recent Orders
          </h1>
        </div>
        <div className="flex items-center gap-2 bg-[#1f1f1f] rounded-md mx-6 px-5 py-2 text-white">
          <CiSearch size={32} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search..."
            className="bg-[#1f1f1f] text-[#f5f5f5] px-2 py-1 rounded-md outline-none w-full"
          />
        </div>

        {/* Order List */}
        <div className="overflow-y-scroll h-[350px] scrollbar-hide pb-12 relative">
          {isLoading ? (
            <div
              className="absolute inset-0 flex items-center justify-center"
              role="alert"
              aria-live="assertive"
              aria-busy="true"
            >
              <div className="bg-[#262626] p-6 rounded-lg shadow-xl">
                <div className="flex items-center gap-3">
                  <svg
                    className="animate-spin h-6 w-6 text-blue-400"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span className="text-white font-medium">Loading...</span>
                </div>
              </div>
            </div>
          ) : orders.length > 0 ? (
            orders.map((order) => <OrderList key={order._id} order={order} />)
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-500 text-lg">No order available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecentOrders;
