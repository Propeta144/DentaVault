// The DentaVault brand mark: sparkle + tooth + "R" (Teodosio-Rufin), styled
// after the clinic's own tarpaulin logo. Fill (not stroke) so it reads as a
// solid mark down to the ~20px sizes it's used at in the sidebar/login
// header; uses currentColor so it still picks up the accent color classes
// (text-sky-*) at each call site, same as before.
export default function ToothIcon({ className, ...props }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className} {...props}>
      <path d="M15 8 L16.4 12 L20.5 13.3 L16.4 14.6 L15 18.6 L13.6 14.6 L9.5 13.3 L13.6 12 Z" />
      <g transform="translate(-4.8,9.2) scale(2.4)">
        <path d="M7 5Q7 2 12 2Q17 2 17 5L17 11Q17 14 15 15.5L13 21Q12.5 22 12 22Q11.5 22 11 21L9 15.5Q7 14 7 11Z" />
      </g>
      <text x="34" y="80" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="66">
        R
      </text>
    </svg>
  )
}
