// Binabalot 'to sa isang async route handler para ipasa yung rejected
// promise papunta sa error handler ni Express, sa halip na basta mag-crash
// nang unhandled yung process.
export default function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
