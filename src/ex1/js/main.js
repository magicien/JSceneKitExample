import {
  CanUseWebGL2
} from 'jscenekit'

import GameViewController from './GameViewController'

document.addEventListener('DOMContentLoaded', () => {
  console.log(CanUseWebGL2);
  if(!CanUseWebGL2()){
    alert(
      'This browser does not support WebGL2/GLSL ES3.0.\n'
      + 'Please use browsers which support WebGL2 (such as Chrome, Firefox, Opera)'
    )
  }

  const root = document.getElementById('root')
  const controller = new GameViewController()

  controller.view.appendTo(root)
  controller.viewDidLoad()
}, false)

