import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getPayments } from "../api";

export const usePayments = (params) => {
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["payments", params],
    queryFn: () => getPayments(params), // Mengambil langsung dari API
    placeholderData: keepPreviousData,
    staleTime: 30000,
  });

  return {
    payments: data || [], // Langsung ambil 'data' dari query tanpa select
    isLoading,
    isFetching,
    error,
  };
};
