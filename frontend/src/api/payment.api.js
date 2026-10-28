import api from "./http";

export const getPayments = async (params = {}) => {
  const res = await api.get(`/api/payment`, { params });
  console.log("response payment: ", res);
  // Mengambil data dengan aman menggunakan optional chaining
  return res.data?.data || res.data || [];
};

export const createOrderMidtrans = async (data) => {
  const res = await api.post("/api/payment/create-order", data);
  return res.data?.data || res.data;
};

export const verifyPaymentMidtrans = (data) =>
  api.post("/api/payment/verify-payment", data);

// export const createCashPayment = (data) => api.post(`/api/payment/cash`, data);
// export const getPayments = async ({
//   page = 1,
//   limit = 10,
//   status,
//   period,
//   search
// } = {}) => {
//   const params = new URLSearchParams({
//     page: page.toString(),
//     limit: limit.toString(),
//   });

//   if (status) params.append("status", status);
//   if (period) params.append("period", period);

//   const res = await api.get(`/api/payment?${params.toString()}`);

//   return {
//     data: res.data?.data || [],
//     totalPages: res.data?.totalPage || 1,
//     totalAmount: res.data?.totalAmount || 0,
//   };
// };
