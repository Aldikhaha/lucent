/** Light/dark follows the Windows app theme (WebView2 reports it via prefers-color-scheme). */
const mq = window.matchMedia('(prefers-color-scheme: dark)')

const apply = () => document.documentElement.classList.toggle('dark', mq.matches)

apply()
mq.addEventListener('change', apply)
