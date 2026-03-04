import { AppError } from './AppError'

/**
 * Errors related to user authentication (login, register, authorization)
 */
export class AuthError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 401)
  }
}

/** User is not authenticated */
export class UnauthenticatedError extends AppError {
  constructor(message: string = 'You are not logged in') {
    super(message, 401)
  }
}

/** User does not have permission to perform this action */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'You do not have permission to perform this action') {
    super(message, 403)
  }
}

/** Invalid email or password */
export class InvalidCredentialsError extends AppError {
  constructor(message: string = 'Invalid email or password') {
    super(message, 401)
  }
}

/** Email is already registered */
export class EmailAlreadyExistsError extends AppError {
  constructor(message: string = 'This email is already registered') {
    super(message, 409)
  }
}
