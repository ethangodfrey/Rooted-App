interface FieldErrorProps {
  id?: string;
  message?: string | null;
}

export function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p id={id} className="app-field-error" role="alert">
      {message}
    </p>
  );
}
