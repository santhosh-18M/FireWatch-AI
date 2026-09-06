import {
  Activity,
  Bell,
  Flame,
  Menu,
  Moon,
  Sun,
} from "lucide-react";

import {
  Link,
} from "react-router-dom";

import type {
  Theme,
} from "./Layout";


interface TopBarProps {

  onMenuClick:
  () => void;

  theme:
  Theme;

  onThemeToggle:
  () => void;
}


export default function TopBar({
  onMenuClick,
  theme,
  onThemeToggle,
}: TopBarProps) {

  const isDark =
    theme === "dark";


  return (

    <header
      className="
        z-20
        flex
        h-16
        shrink-0
        border-b
        border-cyan-400/10
        bg-ink-800/90
        backdrop-blur-xl
        transition-colors
        duration-300
      "
    >

      <div
        className="
          flex
          h-16
          w-full
          items-center
          gap-3
          px-4
          lg:px-6
        "
      >

        {/* ===============================================
            MOBILE MENU
        ================================================ */}

        <button
          onClick={
            onMenuClick
          }
          className="
            rounded-lg
            p-2
            text-slate-400
            transition
            hover:bg-cyan-400/5
            hover:text-cyan-500
            lg:hidden
          "
        >

          <Menu className="h-5 w-5" />

        </button>


        {/* ===============================================
            TITLE
        ================================================ */}

        <div className="hidden md:block">

          <p
            className="
              text-sm
              font-semibold
              text-white
            "
          >

            Thermal Monitoring Dashboard

          </p>


          <p
            className="
              text-[10px]
              text-slate-500
            "
          >

            NASA FIRMS near-real-time thermal anomaly monitoring

          </p>

        </div>


        {/* ===============================================
            RIGHT SIDE
        ================================================ */}

        <div
          className="
            ml-auto
            flex
            items-center
            gap-2
          "
        >

          {/* ===========================================
              THEME BUTTON
          ============================================ */}

          <button
            onClick={
              onThemeToggle
            }
            title={
              isDark
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            aria-label={
              isDark
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            className="
              flex
              h-[38px]
              w-[38px]
              items-center
              justify-center
              rounded-xl
              border
              border-cyan-400/15
              bg-ink-700/45
              text-slate-400
              transition-all
              duration-200
              hover:border-cyan-400/30
              hover:bg-cyan-400/[0.06]
              hover:text-cyan-500
            "
          >

            {isDark ? (

              <Sun
                className="
                  h-[17px]
                  w-[17px]
                "
              />

            ) : (

              <Moon
                className="
                  h-[17px]
                  w-[17px]
                "
              />

            )}

          </button>


          {/* ===========================================
              ALERTS
          ============================================ */}

          <Link
            to="/alerts"
            className="
              flex
              items-center
              gap-2
              rounded-xl
              border
              border-white/10
              bg-ink-700/45
              px-3
              py-2
              text-sm
              text-slate-300
              transition-all
              hover:border-amber-400/30
              hover:bg-amber-400/[0.04]
              hover:text-white
            "
          >

            <Bell
              className="
                h-4
                w-4
                text-amber-400
              "
            />


            <span className="hidden sm:inline">

              Alerts

            </span>

          </Link>


          {/* ===========================================
              FIRMS NRT
          ============================================ */}

          <div
            className="
              hidden
              items-center
              gap-2
              rounded-xl
              border
              border-emerald-400/20
              bg-emerald-400/[0.035]
              px-3
              py-2
              text-sm
              text-slate-300
              sm:flex
            "
          >

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
                  opacity-50
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


            <Activity
              className="
                h-4
                w-4
                text-emerald-400
              "
            />


            <span
              className="
                font-mono
                text-xs
                tracking-wide
              "
            >

              FIRMS NRT

            </span>

          </div>


          {/* ===========================================
              FIREWATCH IDENTITY
          ============================================ */}

          <div
            className="
              flex
              items-center
              gap-2
              rounded-xl
              border
              border-cyan-400/15
              bg-cyan-400/[0.025]
              px-2
              py-1.5
            "
          >

            <div
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-lg
                bg-gradient-to-br
                from-orange-500
                to-red-600
                text-white
                shadow-[0_0_18px_rgba(249,115,22,0.20)]
              "
            >

              <Flame className="h-4 w-4" />

            </div>


            <div
              className="
                hidden
                pr-1
                text-left
                sm:block
              "
            >

              <p
                className="
                  text-xs
                  font-semibold
                  leading-tight
                  text-white
                "
              >

                FireWatch

              </p>


              <p
                className="
                  text-[10px]
                  text-cyan-500/70
                "
              >

                Thermal Intelligence

              </p>

            </div>

          </div>

        </div>

      </div>

    </header>
  );
}