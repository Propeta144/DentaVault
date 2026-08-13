// I-throw 'to galing sa controllers/services kapag alam mo na yung HTTP
// status na dapat lumabas (404, 403, 409, ...). Kahit ano pang lumusot na
// error, ituturing na lang na unexpected 500 ng errorHandler.js.
export default class AppError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}
