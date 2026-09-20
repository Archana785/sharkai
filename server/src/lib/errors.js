/** An error that is safe to show to the user. `code` is stable, `message` is friendly. */
export class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (fields) this.fields = fields; // { fieldName: 'friendly message' } for forms
  }
}

/** The model answered, but not in a shape we can use. Triggers one retry. */
export class BadModelOutput extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'BadModelOutput';
  }
}
