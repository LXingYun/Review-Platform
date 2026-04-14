import { useEffect, useState } from "react";

const getInitialVisibility = () => {
  if (typeof document === "undefined") return true;
  return !document.hidden;
};

export const usePageVisibility = () => {
  const [isVisible, setIsVisible] = useState(getInitialVisibility);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const onVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return {
    isPageVisible: isVisible,
  };
};
