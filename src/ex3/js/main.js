import * as SceneKitExtensions from './CAAnimationSceneName.js'
import ViewController from './ViewController'

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root')
  const controller = new ViewController()

  controller.view.appendTo(root)
  controller.viewDidLoad()
  controller.view.viewDidMoveToWindow()

  controller.view._canvas.focus()
}, false)

