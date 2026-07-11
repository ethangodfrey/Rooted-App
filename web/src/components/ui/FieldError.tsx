interface FieldErrorProps {
  message?: string | null;
}

export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p className="app-field-error" role="alert">
      {message}
    </p>
  );
}
