interface FormFieldErrorProps {
  message?: string | null;
}

export function FormFieldError({ message }: FormFieldErrorProps) {
  if (!message) return null;
  return <p className="app-field-error" role="alert">{message}</p>;
}
