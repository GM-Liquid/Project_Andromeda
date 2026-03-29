const desktopRulebookNav = window.matchMedia("(min-width: 1200px)");
const rulebookCloseTimers = new WeakMap<HTMLElement, number>();

function cancelCloseRulebookItem(item: HTMLElement) {
  const timerId = rulebookCloseTimers.get(item);
  if (timerId !== undefined) {
    window.clearTimeout(timerId);
    rulebookCloseTimers.delete(item);
  }
}

function closeRulebookItem(item: HTMLElement) {
  cancelCloseRulebookItem(item);
  item.removeAttribute("data-open");
}

function scheduleCloseRulebookItem(item: HTMLElement, delay = 160) {
  cancelCloseRulebookItem(item);

  const timerId = window.setTimeout(() => {
    rulebookCloseTimers.delete(item);
    closeRulebookItem(item);
  }, delay);

  rulebookCloseTimers.set(item, timerId);
}

function openRulebookItem(item: HTMLElement) {
  if (!desktopRulebookNav.matches || item.dataset.hasFlyout !== "true") {
    return;
  }

  const nav = item.closest(".rulebook-nav");
  if (!nav) {
    return;
  }

  nav
    .querySelectorAll(".rulebook-nav-item[data-open='true']")
    .forEach((openItem) => {
      if (openItem !== item) {
        closeRulebookItem(openItem as HTMLElement);
      }
    });

  cancelCloseRulebookItem(item);
  item.setAttribute("data-open", "true");
}

function closeAllRulebookItems(nav: ParentNode) {
  nav
    .querySelectorAll(".rulebook-nav-item[data-open='true']")
    .forEach((item) => {
      closeRulebookItem(item as HTMLElement);
    });
}

function setupRulebookNav() {
  const navs = document.querySelectorAll(".rulebook-nav");

  navs.forEach((nav) => {
    const onClick = (event: Event) => {
      const target = event.target as Element | null;
      if (!target?.closest("a")) {
        return;
      }

      closeAllRulebookItems(nav);
    };

    nav.addEventListener("click", onClick);
    window.addCleanup(() => nav.removeEventListener("click", onClick));

    const flyoutItems = nav.querySelectorAll(
      ".rulebook-nav-item[data-has-flyout='true']",
    ) as NodeListOf<HTMLElement>;

    flyoutItems.forEach((item) => {
      const flyout = item.querySelector(
        ".rulebook-nav-flyout",
      ) as HTMLElement | null;
      const onMouseEnter = () => openRulebookItem(item);
      const onMouseLeave = () => scheduleCloseRulebookItem(item);
      const onFocusIn = () => openRulebookItem(item);
      const onFocusOut = (event: FocusEvent) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (nextTarget && item.contains(nextTarget)) {
          return;
        }

        closeRulebookItem(item);
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape") {
          return;
        }

        closeRulebookItem(item);
        const link = item.querySelector(
          ".rulebook-nav-link",
        ) as HTMLElement | null;
        link?.focus();
      };
      const onFlyoutMouseEnter = () => cancelCloseRulebookItem(item);
      const onFlyoutMouseLeave = () => scheduleCloseRulebookItem(item);

      item.addEventListener("mouseenter", onMouseEnter);
      item.addEventListener("mouseleave", onMouseLeave);
      item.addEventListener("focusin", onFocusIn);
      item.addEventListener("focusout", onFocusOut);
      item.addEventListener("keydown", onKeyDown);
      flyout?.addEventListener("mouseenter", onFlyoutMouseEnter);
      flyout?.addEventListener("mouseleave", onFlyoutMouseLeave);

      window.addCleanup(() =>
        item.removeEventListener("mouseenter", onMouseEnter),
      );
      window.addCleanup(() =>
        item.removeEventListener("mouseleave", onMouseLeave),
      );
      window.addCleanup(() => item.removeEventListener("focusin", onFocusIn));
      window.addCleanup(() => item.removeEventListener("focusout", onFocusOut));
      window.addCleanup(() => item.removeEventListener("keydown", onKeyDown));
      window.addCleanup(() =>
        flyout?.removeEventListener("mouseenter", onFlyoutMouseEnter),
      );
      window.addCleanup(() =>
        flyout?.removeEventListener("mouseleave", onFlyoutMouseLeave),
      );
    });
  });

  const onViewportChange = () => {
    if (desktopRulebookNav.matches) {
      return;
    }

    document
      .querySelectorAll(".rulebook-nav-item[data-open='true']")
      .forEach((item) => {
        closeRulebookItem(item as HTMLElement);
      });
  };

  desktopRulebookNav.addEventListener("change", onViewportChange);
  window.addCleanup(() =>
    desktopRulebookNav.removeEventListener("change", onViewportChange),
  );
}

document.addEventListener("nav", setupRulebookNav);
