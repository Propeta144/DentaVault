import markUrl from '../../assets/brand/teodosio-rufin-mark.svg'

// Ang official mark ng clinic (tooth + "R" + sparkle), galing sa
// LOGOS/teodosio-rufin-mark.svg. Pinalitan nito ang dating hand-drawn na
// ToothIcon.
//
// CSS mask ang gamit (hindi <img>), para sumunod ang kulay sa `text-*` class
// (currentColor), parang icon: puti sa madilim na sidebar, purple sa login.
// Kapag <img> lang, laging dark purple (#3A2266) ito at hindi makikita sa
// dark sidebar.
export default function BrandMark({ className = '', label }) {
  const mask = {
    maskImage: `url(${markUrl})`,
    WebkitMaskImage: `url(${markUrl})`,
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
    backgroundColor: 'currentColor',
  }
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      className={`inline-block shrink-0 ${className}`}
      style={mask}
    />
  )
}
