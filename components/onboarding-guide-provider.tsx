"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  ONBOARDING_STEPS,
  getNextStep,
  getPreviousStep,
  markOnboardingCompleted,
  resolveStartStep,
  setOnboardingSkippedInSession,
  shouldAutoOpenOnboarding,
  type OnboardingStep,
  type OnboardingStepId,
} from "@/lib/ui/onboarding-guide";
import { lockPageScroll, unlockPageScroll } from "@/lib/ui/scroll-lock";

type OnboardingGuideContextValue = {
  openGuide: () => void;
};

const OnboardingGuideContext = createContext<OnboardingGuideContextValue | null>(null);

const GUIDE_STEP_LABEL: Record<OnboardingStep["route"], string> = {
  "/": "홈",
  "/photos": "앨범",
  "/guestbook": "덕담",
};

export function useOnboardingGuide(): OnboardingGuideContextValue {
  const context = useContext(OnboardingGuideContext);

  if (!context) {
    throw new Error("useOnboardingGuide must be used within OnboardingGuideProvider");
  }

  return context;
}

export function OnboardingGuideProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [activeStepId, setActiveStepId] = useState<OnboardingStepId>(ONBOARDING_STEPS[0].id);
  const hasAutoCheckedRef = useRef(false);

  const activeStepIndex = ONBOARDING_STEPS.findIndex((step) => step.id === activeStepId);
  const activeStep = ONBOARDING_STEPS[activeStepIndex] ?? ONBOARDING_STEPS[0];

  useEffect(() => {
    if (typeof window === "undefined" || hasAutoCheckedRef.current) {
      return;
    }

    hasAutoCheckedRef.current = true;

    if (!shouldAutoOpenOnboarding(window.localStorage, window.sessionStorage)) {
      return;
    }

    const startStep = resolveStartStep(pathname);
    const frame = window.requestAnimationFrame(() => {
      setActiveStepId(startStep.id);
      setIsOpen(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const snapshot = lockPageScroll();

    return () => {
      unlockPageScroll(snapshot);
    };
  }, [isOpen]);

  const moveToStep = useCallback(
    (nextStep: OnboardingStep | null) => {
      if (!nextStep) {
        return;
      }

      setActiveStepId(nextStep.id);

      if (activeStep.route !== nextStep.route) {
        router.push(nextStep.route);
      }
    },
    [activeStep.route, router],
  );

  const handleSkip = useCallback(() => {
    if (typeof window !== "undefined") {
      setOnboardingSkippedInSession(window.sessionStorage, true);
    }

    setIsOpen(false);
  }, []);

  const handleComplete = useCallback(() => {
    if (typeof window !== "undefined") {
      markOnboardingCompleted(window.localStorage);
      setOnboardingSkippedInSession(window.sessionStorage, false);
    }

    setIsOpen(false);
  }, []);

  const handleNext = useCallback(() => {
    const nextStep = getNextStep(activeStep.id);

    if (!nextStep) {
      handleComplete();
      return;
    }

    moveToStep(nextStep);
  }, [activeStep.id, handleComplete, moveToStep]);

  const handlePrevious = useCallback(() => {
    const previousStep = getPreviousStep(activeStep.id);
    moveToStep(previousStep);
  }, [activeStep.id, moveToStep]);

  const openGuide = useCallback(() => {
    if (typeof window !== "undefined") {
      setOnboardingSkippedInSession(window.sessionStorage, false);
    }

    setActiveStepId(ONBOARDING_STEPS[0].id);
    setIsOpen(true);
  }, []);

  const contextValue = useMemo(
    () => ({
      openGuide,
    }),
    [openGuide],
  );

  const isLastStep = getNextStep(activeStep.id) === null;

  return (
    <OnboardingGuideContext.Provider value={contextValue}>
      {children}

      {isOpen ? (
        <div
          className="fixed inset-0 z-[var(--z-overlay)] flex items-end bg-[color:color-mix(in_srgb,var(--color-ink)_34%,transparent)] p-4 backdrop-blur-[2px] sm:items-center sm:justify-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleSkip();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="사용 가이드"
            className="layout-container w-full"
          >
            <div className="ui-surface w-full rounded-[1.2rem] border border-[color:var(--color-line)] p-4 sm:mx-auto sm:max-w-[28rem] sm:p-5">
              <header className="space-y-1">
                <p className="text-[0.74rem] font-semibold tracking-[0.01em] text-[color:var(--color-muted)]">
                  {activeStepIndex + 1} / {ONBOARDING_STEPS.length}
                </p>
                <p className="text-[0.72rem] font-semibold text-[color:var(--color-brand-strong)]">
                  {GUIDE_STEP_LABEL[activeStep.route]} 안내
                </p>
                <h2 className="text-[1rem] font-bold leading-[1.4] text-[color:var(--color-ink)]">
                  {activeStep.title}
                </h2>
              </header>

              <p className="mt-2 text-[0.9rem] leading-[1.6] text-[color:var(--color-muted)]">
                {activeStep.description}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={activeStepIndex <= 0}
                  className="ui-btn ui-btn-secondary min-h-[var(--tap-min)] px-4"
                >
                  이전
                </button>

                <button
                  type="button"
                  onClick={handleSkip}
                  className="ui-btn ui-btn-secondary min-h-[var(--tap-min)] px-4"
                >
                  나중에 보기
                </button>

                <button
                  type="button"
                  onClick={isLastStep ? handleComplete : handleNext}
                  className="ui-btn ui-btn-primary ml-auto min-h-[var(--tap-min)] px-4"
                >
                  {isLastStep ? "완료" : "다음"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </OnboardingGuideContext.Provider>
  );
}
