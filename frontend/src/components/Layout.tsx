import {
  useEffect,
  useState,
} from "react";

import {
  Outlet,
} from "react-router-dom";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";


export type Theme =
  | "light"
  | "dark";


function getInitialTheme(): Theme {

  const savedTheme =
    localStorage.getItem(
      "firewatch-theme"
    );


  if (
    savedTheme === "light" ||
    savedTheme === "dark"
  ) {

    return savedTheme;
  }


  /*
   * If no preference has been saved,
   * use the computer/browser theme.
   */

  const prefersDark =
    window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;


  return prefersDark
    ? "dark"
    : "light";
}


export default function Layout() {

  const [
    sidebarOpen,
    setSidebarOpen,
  ] =
    useState(false);


  const [
    theme,
    setTheme,
  ] =
    useState<Theme>(
      getInitialTheme
    );


  /* =====================================================
     APPLY THEME
  ====================================================== */

  useEffect(
    () => {

      const root =
        document.documentElement;


      if (
        theme === "dark"
      ) {

        root.classList.add(
          "dark"
        );

      } else {

        root.classList.remove(
          "dark"
        );
      }


      root.setAttribute(
        "data-theme",
        theme
      );


      localStorage.setItem(
        "firewatch-theme",
        theme
      );

    },
    [
      theme,
    ]
  );


  /* =====================================================
     TOGGLE
  ====================================================== */

  function toggleTheme() {

    setTheme(
      current =>
        current === "dark"
          ? "light"
          : "dark"
    );
  }


  return (

    <div
      className="
        flex
        h-screen
        w-full
        overflow-hidden
        bg-ink-900
        transition-colors
        duration-300
      "
    >

      <Sidebar
        open={
          sidebarOpen
        }
        onClose={
          () =>
            setSidebarOpen(
              false
            )
        }
      />


      <div
        className="
          flex
          flex-1
          flex-col
          overflow-hidden
        "
      >

        <TopBar
          onMenuClick={
            () =>
              setSidebarOpen(
                true
              )
          }
          theme={
            theme
          }
          onThemeToggle={
            toggleTheme
          }
        />


        <main
          className="
            scrollbar-thin
            flex-1
            overflow-y-auto
            bg-ink-900
            transition-colors
            duration-300
          "
        >

          <Outlet />

        </main>

      </div>

    </div>
  );
}