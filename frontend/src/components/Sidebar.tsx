import { NavLink } from "react-router-dom";

import {
  Map,
  Bell,
  BarChart3,
  Database,
  Flame,
  X,
  Radio,
} from "lucide-react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}


const navItems = [
  {
    to: "/",
    label: "Live Monitoring",
    icon: Map,
  },
  {
    to: "/alerts",
    label: "Active Alerts",
    icon: Bell,
  },
  {
    to: "/gis-history",
    label: "GIS History",
    icon: Database,
  },
];


export default function Sidebar({
  open,
  onClose,
}: SidebarProps) {

  return (
    <>

      {/* ===============================================
          MOBILE OVERLAY
      ================================================ */}

      {open && (

        <div
          className="
            fixed
            inset-0
            z-30
            bg-black/60
            backdrop-blur-sm
            lg:hidden
          "
          onClick={onClose}
        />

      )}


      <aside
        className={`
          fixed
          z-40
          h-full
          w-[220px]
          shrink-0
          transform
          border-r
          border-cyan-400/10
          bg-ink-800/95
          backdrop-blur-xl
          transition-transform
          duration-300
          lg:static

          ${open
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
          }
        `}
      >

        <div className="flex h-full flex-col">

          {/* ===============================================
              BRAND
          ================================================ */}

          <div
            className="
              flex
              items-center
              justify-between
              gap-3
              border-b
              border-cyan-400/10
              px-4
              py-5
            "
          >

            <div className="flex items-center gap-3">

              <div
                className="
                  relative
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-xl
                  bg-gradient-to-br
                  from-orange-500
                  to-red-600
                  shadow-[0_0_22px_rgba(249,115,22,0.20)]
                "
              >

                <Flame
                  className="h-5 w-5 text-white"
                  strokeWidth={2.5}
                />

              </div>


              <div>

                <h1 className="text-sm font-bold leading-tight text-white">

                  FireWatch AI

                </h1>


                <p
                  className="
                    text-[9px]
                    font-medium
                    uppercase
                    tracking-wider
                    text-cyan-300/60
                  "
                >

                  Thermal Intelligence

                </p>

              </div>

            </div>


            <button
              onClick={onClose}
              className="
                rounded-lg
                p-1.5
                text-slate-400
                transition
                hover:bg-cyan-400/5
                hover:text-cyan-300
                lg:hidden
              "
            >

              <X className="h-4 w-4" />

            </button>

          </div>


          {/* ===============================================
              NAVIGATION
          ================================================ */}

          <nav className="flex-1 px-2.5 py-4">

            <p
              className="
                px-3
                pb-2
                text-[9px]
                font-semibold
                uppercase
                tracking-widest
                text-slate-500
              "
            >

              Monitoring

            </p>


            {navItems.map(
              item => {

                const Icon =
                  item.icon;

                return (

                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    end={item.to === "/"}
                    className={({
                      isActive,
                    }) => `
                      group
                      relative
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      px-3
                      py-2.5
                      text-[13px]
                      font-medium
                      transition-all
                      duration-200

                      ${isActive
                        ? "bg-gradient-to-r from-cyan-400/12 via-cyan-400/[0.04] to-transparent text-white"
                        : "text-slate-400 hover:bg-cyan-400/[0.035] hover:text-slate-100"
                      }
                    `}
                  >

                    {({
                      isActive,
                    }) => (
                      <>

                        {isActive && (

                          <span
                            className="
                              absolute
                              left-0
                              top-1/2
                              h-5
                              w-1
                              -translate-y-1/2
                              rounded-r-full
                              bg-cyan-400
                              shadow-[0_0_12px_rgba(34,211,238,0.45)]
                            "
                          />

                        )}


                        <Icon
                          className={`
                            h-[18px]
                            w-[18px]
                            transition-colors

                            ${isActive
                              ? "text-cyan-300"
                              : "text-slate-500 group-hover:text-cyan-200"
                            }
                          `}
                          strokeWidth={2}
                        />


                        <span>
                          {item.label}
                        </span>

                      </>
                    )}

                  </NavLink>

                );

              }
            )}

          </nav>


          {/* ===============================================
              SYSTEM STATUS
          ================================================ */}

          <div
            className="
              border-t
              border-cyan-400/10
              px-3
              py-3
            "
          >

            <div
              className="
                rounded-xl
                border
                border-emerald-400/10
                bg-emerald-400/[0.025]
                p-3
              "
            >

              <div className="flex items-center gap-2">

                <span className="relative flex h-2 w-2">

                  <span
                    className="
                      absolute
                      inline-flex
                      h-full
                      w-full
                      animate-ping
                      rounded-full
                      bg-emerald-400
                      opacity-60
                    "
                  />

                  <span
                    className="
                      relative
                      inline-flex
                      h-2
                      w-2
                      rounded-full
                      bg-emerald-400
                    "
                  />

                </span>


                <span className="text-[11px] font-medium text-slate-300">

                  System Online

                </span>

              </div>


              <div
                className="
                  mt-2
                  flex
                  items-center
                  gap-2
                  text-[9px]
                  text-slate-500
                "
              >

                <Radio className="h-3 w-3 text-emerald-400" />

                <span>

                  FIRMS NRT feed available

                </span>

              </div>

            </div>

          </div>

        </div>

      </aside>

    </>
  );
}