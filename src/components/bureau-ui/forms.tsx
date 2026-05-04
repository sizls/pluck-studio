// ---------------------------------------------------------------------------
// bureau-ui/forms — shared form primitives across Bureau program flows
// ---------------------------------------------------------------------------
//
// DRAGNET, OATH, TRIPWIRE, and the rest of the 11 alpha programs share
// the same activation-form chrome: target field, secondary identifier
// (probe-pack ID / oath URL / etc.), cadence radio, ToS-ack checkbox,
// disclosure footer, submit button. Each program has DIFFERENT field
// shapes, but the VISUAL primitives are constant.
//
// Per the architecture-review minor in R1+R2 ("inline-style duplication
// across forms"), this file is the single source of truth for those
// primitives. New programs import from here; if a primitive drifts,
// every program's UX drifts together.
// ---------------------------------------------------------------------------

import type {
  ChangeEvent,
  CSSProperties,
  ReactNode,
} from "react";

const InputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  background: "var(--bureau-bg)",
  color: "var(--bureau-fg)",
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 4,
  marginTop: 4,
};

const LabelStyle: CSSProperties = {
  display: "block",
  marginTop: 16,
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const HelpTextStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--bureau-fg-dim)",
  marginTop: 4,
};

const ButtonStyle: CSSProperties = {
  marginTop: 24,
  padding: "10px 20px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  background: "var(--bureau-fg)",
  color: "var(--bureau-bg)",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};

interface BureauInputProps {
  type?: "text" | "url" | "email";
  name: string;
  required?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  testId?: string;
}

export function BureauInput({
  type = "text",
  name,
  required,
  autoFocus,
  placeholder,
  value,
  onChange,
  testId,
}: BureauInputProps): ReactNode {
  return (
    <input
      type={type}
      name={name}
      required={required}
      autoFocus={autoFocus}
      placeholder={placeholder}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      style={InputStyle}
      data-testid={testId}
    />
  );
}

interface BureauLabelProps {
  text: string;
  children: ReactNode;
}

export function BureauLabel({
  text,
  children,
}: BureauLabelProps): ReactNode {
  return (
    <label style={LabelStyle}>
      {text}
      {children}
    </label>
  );
}

interface BureauHelpTextProps {
  children: ReactNode;
}

export function BureauHelpText({
  children,
}: BureauHelpTextProps): ReactNode {
  return <p style={HelpTextStyle}>{children}</p>;
}

interface BureauCheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  testId?: string;
}

export function BureauCheckbox({
  checked,
  onChange,
  children,
  testId,
}: BureauCheckboxProps): ReactNode {
  return (
    <label style={{ display: "block", marginTop: 24 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={testId}
      />{" "}
      {children}
    </label>
  );
}

interface BureauRadioOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  testId?: string;
}

interface BureauRadioGroupProps<T extends string> {
  name: string;
  legend: string;
  options: ReadonlyArray<BureauRadioOption<T>>;
  value: T;
  onChange: (v: T) => void;
  testId?: string;
}

export function BureauRadioGroup<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  testId,
}: BureauRadioGroupProps<T>): ReactNode {
  return (
    <fieldset
      style={{ marginTop: 16, border: "none", padding: 0 }}
      data-testid={testId}
    >
      <legend style={LabelStyle}>{legend}</legend>
      {options.map((opt) => (
        <label
          key={opt.value}
          style={{
            display: "block",
            marginTop: 8,
            ...(opt.disabled
              ? { color: "var(--bureau-fg-dim)" }
              : undefined),
          }}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            disabled={opt.disabled}
            onChange={() => onChange(opt.value)}
            data-testid={opt.testId}
          />{" "}
          {opt.label}
        </label>
      ))}
    </fieldset>
  );
}

interface BureauButtonProps {
  type?: "button" | "submit";
  disabled?: boolean;
  children: ReactNode;
  testId?: string;
  onClick?: () => void;
}

export function BureauButton({
  type = "button",
  disabled,
  children,
  testId,
  onClick,
}: BureauButtonProps): ReactNode {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ ...ButtonStyle, opacity: disabled ? 0.6 : 1 }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

interface SignInPromptProps {
  signInUrl: string;
  /**
   * What the user was about to do, in verb-phrase form ("run a
   * probe-pack", "verify this oath"). Defaults to a generic phrase.
   * Caller-provided so the copy reads correctly per program.
   */
  action?: string;
  testId?: string;
}

export function BureauSignInPrompt({
  signInUrl,
  action = "continue",
  testId,
}: SignInPromptProps): ReactNode {
  return (
    <p
      style={{ marginTop: 16, color: "var(--bureau-fg-dim)" }}
      data-testid={testId}
    >
      You need to be signed in to {action}.{" "}
      <a href={signInUrl}>Sign in</a> and try again.
    </p>
  );
}

interface BureauErrorProps {
  message: string;
  testId?: string;
}

export function BureauError({ message, testId }: BureauErrorProps): ReactNode {
  return (
    <p
      style={{ marginTop: 16, color: "#ff4444" }}
      data-testid={testId}
      role="alert"
      aria-live="polite"
    >
      {message}
    </p>
  );
}
