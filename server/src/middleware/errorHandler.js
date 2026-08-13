// Central error handler 'to. Pwedeng mag-throw ng plain Error objects yung
// controllers, o mag-attach ng `status` para i-signal yung tamang HTTP
// code (tignan utils/AppError.js).
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500
  if (status === 500) {
    console.error(err)
  }
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  })
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` })
}
