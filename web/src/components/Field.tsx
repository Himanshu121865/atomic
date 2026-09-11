import type { CSSProperties, ReactNode } from "react";
import { Notation } from "../lib/mathText";

export function ControlGroup({
  title,
  hint,
  tone = "plain",
  children,
}: {
  title: string;
  hint?: string;
  tone?: "plain" | "active";
  children: ReactNode;
}) {
  return (
    <fieldset className={`control-group control-group-${tone}`}>
      <legend>{title}</legend>
      {hint !== undefined && <p className="control-hint">{hint}</p>}
      {children}
    </fieldset>
  );
}

export function Slider({
  label,
  readout,
  anchor,
  min,
  max,
  step,
  value,
  disabled = false,
  atRest = false,
  onChange,
}: {
  label: string;
  readout?: string;
  anchor?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  atRest?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="control-slider" data-rest={atRest || undefined}>
      <span className="control-label">
        <Notation>{label}</Notation>{" "}
        <strong>{readout ?? value}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ "--fill": `${max > min ? ((value - min) / (max - min)) * 100 : 0}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {anchor !== undefined && (
        <span className="control-hint">{anchor}</span>
      )}
    </label>
  );
}

export function Toggle({
  label,
  checked,
  why,
  disabled = false,
  disabledReason,
  onChange,
}: {
  label: string;
  checked: boolean;
  why?: string;
  disabled?: boolean;
  disabledReason?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <label className="control-toggle">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          <Notation>{label}</Notation>
        </span>
      </label>
      {disabled && disabledReason !== undefined && (
        <p className="control-hint">{disabledReason}</p>
      )}
      {why !== undefined && !disabled && <p className="control-hint">{why}</p>}
    </div>
  );
}

export function Choice<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="control-choice">
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className="choice-option">
          <input
            type="radio"
            name={legend}
            checked={value === o.value}
            disabled={o.disabled}
            onChange={() => onChange(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="control-select">
      <span className="control-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
