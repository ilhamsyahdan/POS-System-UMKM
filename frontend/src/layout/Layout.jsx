import { Outlet } from "react-router";
import Header from "../components/shared/Header";

const Layout = () => {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#1f1f1f]">
      <Header />
      <main className="flex-1 overflow-y-auto bg-[#1f1f1f]">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
