"use client";

import { TriangleAlert } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { as?: "input" };
type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { as: "textarea" };

type FieldProps = (InputProps | TextareaProps) & {
  label: string;
  error?: string;
  hint?: string;
};

/** Labelled input with error/hint wiring (aria-invalid + aria-describedby). */
export const Field = forwardRef<HTMLInputElement | HTMLTextAreaElement, FieldProps>(function Field(props, ref) {
  const { label, error, hint, id: givenId, className, ...rest } = props;
  const autoId = useId();
  const id = givenId ?? autoId;
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`form-group ${className ?? ""}`}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {rest.as === "textarea" ? (
        <textarea
          {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          id={id}
          ref={ref as React.Ref<HTMLTextAreaElement>}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      ) : (
        <input
          {...(Object.fromEntries(Object.entries(rest).filter(([k]) => k !== "as")) as InputHTMLAttributes<HTMLInputElement>)}
          id={id}
          ref={ref as React.Ref<HTMLInputElement>}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      )}
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1 text-sm">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
});

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode; error?: string };

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxProps>(function CheckboxField({ label, error, id: givenId, className, ...rest }, ref) {
  const autoId = useId();
  const id = givenId ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={id} className="checkbox-style">
        <input {...rest} ref={ref} id={id} type="checkbox" aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
        <span>{label}</span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="field-error">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
});
