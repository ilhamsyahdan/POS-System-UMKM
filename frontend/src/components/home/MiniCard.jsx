const MiniCard = ({ title, icon, number, footerNum }) => {
  const hasChange = typeof footerNum === "number";
  const isPositive = hasChange && footerNum >= 0;

  return (
    <div className="bg-[#2a2a2a] rounded-2xl p-4 sm:p-5 lg:p-6 flex-1 shadow-lg hover:shadow-xl border border-[#3a3a3a]">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-400 text-xs sm:text-sm font-medium uppercase tracking-wide">
          {title}
        </span>
        <div className="text-xl sm:text-2xl text-emerald-500 bg-emerald-500/10 p-2 sm:p-3 rounded-xl">
          {icon}
        </div>
      </div>
      <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3">
        {number}
      </div>
      {hasChange && (
        <div className="flex items-center gap-2">
          <span
            className={`text-xs sm:text-sm font-semibold px-2 py-1 rounded-lg ${
              isPositive
                ? "text-emerald-500 bg-emerald-500/10"
                : "text-red-500 bg-red-500/10"
            }`}
          >
            {isPositive ? "+" : ""}
            {footerNum}%
          </span>
          <span className="text-gray-500 text-xs">vs last month</span>
        </div>
      )}

      {footerNum === null && (
        <span className="text-gray-500 text-xs">No data from last month</span>
      )}
    </div>
  );
};

export default MiniCard;
