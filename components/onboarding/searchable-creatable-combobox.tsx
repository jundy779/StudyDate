"use client";

import {
  filterOnboardingOptions,
  type OnboardingOption,
} from "@/lib/onboarding/options/shared";
import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type ComboboxEntryMode = "list" | "manual";

type SearchableCreatableComboboxProps = {
  id: string;
  label: string;
  optional?: boolean;
  value: string;
  options: readonly OnboardingOption[];
  placeholder: string;
  noResultsPrompt: string;
  manualButtonLabel: string;
  manualLabel: string;
  manualPlaceholder: string;
  mode: ComboboxEntryMode;
  error?: string;
  helperText?: string;
  autoComplete?: string;
  maxLength: number;
  onChange: (value: string) => void;
  onModeChange: (mode: ComboboxEntryMode) => void;
};

export function SearchableCreatableCombobox({
  id,
  label,
  optional = false,
  value,
  options,
  placeholder,
  noResultsPrompt,
  manualButtonLabel,
  manualLabel,
  manualPlaceholder,
  mode,
  error,
  helperText,
  autoComplete = "off",
  maxLength,
  onChange,
  onModeChange,
}: SearchableCreatableComboboxProps) {
  const generatedId = useId();
  const listboxId = `${id}-listbox-${generatedId}`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const manualInputId = `${id}-manual`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [manualStatus, setManualStatus] = useState("");

  const filteredOptions = useMemo(
    () => filterOnboardingOptions(options, query),
    [options, query],
  );
  const safeActiveIndex = filteredOptions.length
    ? Math.min(activeIndex, filteredOptions.length - 1)
    : -1;
  const activeOption = filteredOptions[safeActiveIndex];
  const describedBy = [helperText ? descriptionId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  useEffect(() => {
    if (mode === "manual") {
      manualInputRef.current?.focus();
    }
  }, [mode]);

  function selectOption(option: OnboardingOption) {
    onChange(option.label);
    setQuery(option.label);
    setIsOpen(false);
    setActiveIndex(0);
    searchInputRef.current?.focus();
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        filteredOptions.length
          ? Math.min(current + 1, filteredOptions.length - 1)
          : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        filteredOptions.length
          ? current <= 0
            ? filteredOptions.length - 1
            : current - 1
          : 0,
      );
      return;
    }

    if (event.key === "Home" && isOpen && filteredOptions.length) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End" && isOpen && filteredOptions.length) {
      event.preventDefault();
      setActiveIndex(filteredOptions.length - 1);
      return;
    }

    if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      if (activeOption) {
        selectOption(activeOption);
      }
    }
  }

  function useManualEntry() {
    if (!value && query.trim()) {
      onChange(query);
    }
    setIsOpen(false);
    setManualStatus("Mode pengisian manual aktif.");
    onModeChange("manual");
  }

  function returnToSuggestions() {
    setQuery(value);
    setManualStatus("");
    onModeChange("list");
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  if (mode === "manual") {
    const trimmedManualValue = value.trim();

    return (
      <div ref={wrapperRef} className="min-w-0">
        <p className="mb-2 text-sm font-semibold">
          {label}{" "}
          {optional ? (
            <span className="font-normal text-brand-muted">(opsional)</span>
          ) : null}
        </p>
        <label
          htmlFor={manualInputId}
          className="mb-2 block text-sm font-medium text-brand-muted"
        >
          {manualLabel}
        </label>
        <input
          ref={manualInputRef}
          id={manualInputId}
          type="text"
          value={value}
          maxLength={maxLength}
          autoComplete={autoComplete}
          placeholder={manualPlaceholder}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => {
            setManualStatus("");
            onChange(event.target.value);
          }}
          className="focus-ring h-12 w-full rounded-xl border border-brand-border px-4 placeholder:text-brand-muted"
        />
        {helperText ? (
          <p
            id={descriptionId}
            className="mt-2 text-xs leading-5 text-brand-muted"
          >
            {helperText}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="mt-2 text-sm text-brand-error">
            {error}
          </p>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {manualStatus}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={trimmedManualValue.length < 2}
            onClick={() => {
              onChange(trimmedManualValue);
              setManualStatus(`${manualLabel} disimpan.`);
              manualInputRef.current?.focus();
            }}
            className="focus-ring min-h-11 rounded-xl bg-brand-blue px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Gunakan nama ini
          </button>
          <button
            type="button"
            onClick={returnToSuggestions}
            className="focus-ring min-h-11 rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-navy"
          >
            Kembali ke daftar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="relative min-w-0"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
    >
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {label}{" "}
        {optional ? (
          <span className="font-normal text-brand-muted">(opsional)</span>
        ) : null}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted"
          aria-hidden="true"
        />
        <input
          ref={searchInputRef}
          id={id}
          role="combobox"
          type="text"
          value={query}
          maxLength={maxLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={
            isOpen && activeOption
              ? `${listboxId}-option-${safeActiveIndex}`
              : undefined
          }
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onFocus={() => {
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onClick={() => setIsOpen(true)}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setActiveIndex(0);
            setIsOpen(true);
            if (nextQuery !== value) {
              onChange("");
            }
          }}
          onKeyDown={handleSearchKeyDown}
          className="focus-ring h-12 w-full rounded-xl border border-brand-border py-2 pl-11 pr-20 placeholder:text-brand-muted"
        />
        {query || value ? (
          <button
            type="button"
            aria-label={`Hapus pilihan ${label}`}
            onClick={() => {
              onChange("");
              setQuery("");
              setActiveIndex(0);
              setIsOpen(true);
              searchInputRef.current?.focus();
            }}
            className="focus-ring absolute right-10 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-brand-muted hover:text-brand-navy"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        <button
          type="button"
          tabIndex={-1}
          aria-label={`${isOpen ? "Tutup" : "Buka"} daftar ${label}`}
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          onClick={() => {
            setIsOpen((current) => !current);
            searchInputRef.current?.focus();
          }}
          className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-brand-muted"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      </div>
      {helperText ? (
        <p
          id={descriptionId}
          className="mt-2 text-xs leading-5 text-brand-muted"
        >
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-2 text-sm text-brand-error">
          {error}
        </p>
      ) : null}

      {isOpen ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-xl border border-brand-border bg-white shadow-[0_18px_50px_rgba(15,27,51,0.14)]">
          {filteredOptions.length ? (
            <ul
              id={listboxId}
              role="listbox"
              aria-label={`Saran ${label}`}
              className="max-h-[min(14rem,35vh)] overscroll-contain overflow-y-auto p-1.5"
            >
              {filteredOptions.map((option, index) => {
                const isActive = index === safeActiveIndex;
                const isSelected = option.label === value;

                return (
                  <li
                    key={option.searchValue}
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectOption(option)}
                    className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
                      isActive
                        ? "bg-brand-surface text-brand-navy"
                        : "text-brand-muted"
                    }`}
                  >
                    <span>{option.label}</span>
                    {isSelected ? (
                      <Check
                        className="h-4 w-4 shrink-0 text-brand-blue"
                        aria-hidden="true"
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p
              role="status"
              className="px-4 py-5 text-sm leading-6 text-brand-muted"
            >
              Tidak ada hasil yang cocok.
            </p>
          )}
          <div className="border-t border-brand-border p-3">
            <p className="text-xs leading-5 text-brand-muted">
              {noResultsPrompt}
            </p>
            <button
              type="button"
              onClick={useManualEntry}
              className="focus-ring mt-2 min-h-11 w-full rounded-lg border border-brand-border px-3 text-left text-sm font-semibold text-brand-blue hover:border-brand-blue"
            >
              {manualButtonLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
