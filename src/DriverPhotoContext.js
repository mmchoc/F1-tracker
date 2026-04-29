import { createContext, useContext, useState, useEffect } from "react";

export const DriverPhotoContext = createContext({});
export const useDriverPhotos = () => useContext(DriverPhotoContext);

export function DriverPhotoProvider({ children }) {
  const [photos, setPhotos] = useState({});

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // 1. All 2026 drivers from Jolpica (includes Wikipedia URL per driver)
        const res     = await fetch("https://api.jolpi.ca/ergast/f1/2026/drivers.json");
        const json    = await res.json();
        const drivers = json.MRData?.DriverTable?.Drivers || [];
        if (!drivers.length) return;

        // 2. Extract Wikipedia page titles
        const pairs = drivers
          .map(d => ({ code: d.code, title: d.url?.split("/wiki/").pop() || "" }))
          .filter(p => p.code && p.title);

        // 3. Single batched Wikipedia API call (up to 50 titles with pipe separator)
        const titlesParam = pairs.map(p => p.title).join("|");
        const wikiRes = await fetch(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${titlesParam}&prop=pageimages&format=json&pithumbsize=300&origin=*`
        );
        const wikiJson = await wikiRes.json();

        // Build normalisation map: underscore_title → display title
        const normMap = {};
        for (const n of wikiJson.query?.normalized || []) normMap[n.from] = n.to;

        // Build display-title → thumbnail URL map
        const titleToUrl = {};
        for (const page of Object.values(wikiJson.query?.pages || {})) {
          if (page.thumbnail?.source) titleToUrl[page.title] = page.thumbnail.source;
        }

        // Match driver codes → photo URLs
        const photoMap = {};
        for (const { code, title } of pairs) {
          const displayTitle = normMap[title] || title.replace(/_/g, " ");
          if (titleToUrl[displayTitle]) photoMap[code] = titleToUrl[displayTitle];
        }

        setPhotos(photoMap);
      } catch {
        // Fail silently — DriverPhoto falls back to ui-avatars
      }
    };
    fetchAll();
  }, []);

  return (
    <DriverPhotoContext.Provider value={photos}>
      {children}
    </DriverPhotoContext.Provider>
  );
}
