import { useQuery } from "@tanstack/react-query";
import { getOrderStats } from "../api/order.api";

export const useOrderStats = () => {
  const query = useQuery({
    queryKey: ["order-stats"],
    queryFn: getOrderStats,
    select: (res) => res.data.data,
  });

  return { stats: query.data, isLoading: query.isLoading };
};
