// Central error handler 'to. Pwedeng mag-throw ng plain Error objects yung
// controllers, o mag-attach ng `status` para i-signal yung tamang HTTP
// code (tignan utils/AppError.js).
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Upload errors (multer): walang `status` ang MulterError, kaya dati 500
  // "Internal server error" ang lumalabas kapag sobrang laki ng file.
  if (err.name === 'MulterError') {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE'
    return res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? 'That file is too large. Please choose a smaller file.' : `Upload failed: ${err.message}`,
    })
  }

  const status = err.status || 500
  if (status === 500) {
    console.error(err)
  }
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
    ...(status !== 500 && err.extra ? err.extra : {}),
  })
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` })
}
