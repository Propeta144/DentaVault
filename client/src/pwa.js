import { registerSW } from 'virtual:pwa-register'

// Sinadya na 'prompt' yung registerType (tignan vite.config.js): kapag
// kalagitnaan yung dentist ng pag-eenter ng treatment note, hindi dapat
// basta-basta na lang tahimik mag-reload yung app habang ginagamit niya.
// Sa halip, ipapakita na lang natin yung maliit na dismissible banner tapos
// sila na bahalang pumili kung kailan nila kukunin yung update.
export function initPWA() {
  registerSW({
    onNeedRefresh() {
      if (document.getElementById('pwa-update-banner')) return

      const banner = document.createElement('div')
      banner.id = 'pwa-update-banner'
      banner.style.cssText =
        'position:fixed;bottom:16px;left:16px;z-index:9999;display:flex;align-items:center;gap:12px;' +
        'background:#0f172a;color:#fff;padding:12px 16px;border-radius:8px;' +
        'font:14px/1.4 Inter,system-ui,sans-serif;box-shadow:0 8px 20px rgba(0,0,0,.25);max-width:320px'

      const text = document.createElement('span')
      text.textContent = 'A new version of DentaVault is ready.'

      const reloadBtn = document.createElement('button')
      reloadBtn.textContent = 'Reload'
      reloadBtn.style.cssText =
        'background:#0ea5e9;color:#fff;border:none;padding:6px 12px;border-radius:6px;' +
        'cursor:pointer;font-weight:600;font-size:13px;white-space:nowrap'
      reloadBtn.onclick = () => window.location.reload()

      const dismissBtn = document.createElement('button')
      dismissBtn.textContent = '✕'
      dismissBtn.style.cssText = 'background:none;border:none;color:#94a3b8;cursor:pointer;font-size:13px'
      dismissBtn.onclick = () => banner.remove()

      banner.append(text, reloadBtn, dismissBtn)
      document.body.appendChild(banner)
    },
    onOfflineReady() {
      console.info('DentaVault is ready to work offline.')
    },
  })
}
