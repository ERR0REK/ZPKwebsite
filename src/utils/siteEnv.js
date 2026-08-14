// src/utils/siteEnv.js
// Wykrywa, czy strona działa na domenie deweloperskiej.
//
// Domena deweloperska: https://dev-zpkwebsite.netlify.app
// Wersja dev jest PRZEZNACZONA TYLKO dla członków serwera deweloperskiego
// na Discordzie — cała strona jest za bramką DevGuard.
//
// Lokalny dev (localhost) NIE jest traktowany jako domena dev — programista
// może pracować swobodnie bez logowania.

const DEV_HOSTNAMES = ["dev-zpkwebsite.netlify.app"];

export const isDevSite = () => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return DEV_HOSTNAMES.includes(host);
};
