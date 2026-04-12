import { useContext, useEffect, useState } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";

interface BlockedTransition {
  retry: () => void;
}

interface NavigatorWithBlock {
  block?: (blocker: (tx: { retry: () => void }) => void) => () => void;
}

const useNavigationBlock = (when: boolean) => {
  const navigationContext = useContext(UNSAFE_NavigationContext);
  const navigator = navigationContext?.navigator as NavigatorWithBlock | undefined;
  const [blockedTransition, setBlockedTransition] = useState<BlockedTransition | null>(null);

  useEffect(() => {
    if (!when) {
      setBlockedTransition(null);
      return;
    }

    if (!navigator?.block) {
      return;
    }

    let unblock: (() => void) | null = null;

    unblock = navigator.block((tx) => {
      const wrappedTransition: BlockedTransition = {
        retry: () => {
          if (unblock) {
            unblock();
            unblock = null;
          }
          tx.retry();
        },
      };

      setBlockedTransition(wrappedTransition);
    });

    return () => {
      if (unblock) {
        unblock();
        unblock = null;
      }
    };
  }, [navigator, when]);

  return {
    state: blockedTransition ? "blocked" : "unblocked",
    proceed: () => {
      if (!blockedTransition) return;
      setBlockedTransition(null);
      blockedTransition.retry();
    },
    reset: () => {
      setBlockedTransition(null);
    },
  } as const;
};

export const useUnsavedNavigationGuard = (when: boolean) => {
  const blocker = useNavigationBlock(when);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (blocker.state === "blocked") {
      setDialogOpen(true);
    }
  }, [blocker.state]);

  const confirmNavigation = () => {
    setDialogOpen(false);
    if (blocker.state === "blocked") {
      blocker.proceed();
    }
  };

  const cancelNavigation = () => {
    setDialogOpen(false);
    if (blocker.state === "blocked") {
      blocker.reset();
    }
  };

  const onDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open && blocker.state === "blocked") {
      blocker.reset();
    }
  };

  return {
    dialogOpen,
    confirmNavigation,
    cancelNavigation,
    onDialogOpenChange,
  };
};
