import {
  CanUseWebGL2
} from 'jscenekit'

import * as SceneKitExtensions from './CAAnimationSceneName.js'
import ViewController from './ViewController'

document.addEventListener('DOMContentLoaded', () => {
  if(!CanUseWebGL2()){
    alert(
      'This browser does not support WebGL2/GLSL ES3.0.\n'
      + 'Please use browsers which support WebGL2 (such as Chrome, Firefox, Opera)'
    )
  }

  const root = document.getElementById('root')
  const controller = new ViewController()

  controller.view.appendTo(root)
  controller.viewDidLoad()
  controller.view.viewDidMoveToWindow()

  controller.view._canvas.focus()
}, false)

