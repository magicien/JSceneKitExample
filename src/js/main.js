import GameViewController from './GameViewController'

console.log('href: ' + window.location.href)
console.log('protocol: ' + window.location.protocol)
console.log('hostname: ' + window.location.hostname)

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root')
  const controller = new GameViewController()
  controller.view.appendTo(root)
  controller.viewDidLoad()
}, false)

