import GameViewController from './GameViewController'

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root')
  const controller = new GameViewController()

  controller.view.appendTo(root)
  controller.viewDidLoad()
}, false)

