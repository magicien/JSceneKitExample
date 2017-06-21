'use strict'

import {
  CABasicAnimation,
  SCNCamera,
  SCNLight,
  SCNNode,
  SCNScene,
  SCNVector3,
  SCNVector4,
  SKColor
} from 'jscenekit'
import GameView from './GameView'

export default class GameViewController {
  constructor() {
    this.gameView = new GameView()
    this.view = this.gameView
  }

  viewDidLoad() {
    // create a new scene
    const scene = new SCNScene('art.scnassets/ship.scn')
    scene._getLoadedPromise().then(() => {
      // create and add a camera to the scene
      const cameraNode = new SCNNode()
      cameraNode.camera = new SCNCamera()
      scene.rootNode.addChildNode(cameraNode)

      // place the camera
      cameraNode.position = new SCNVector3(0, 0, 15)

      // create and add a light to the scene
      const lightNode = new SCNNode()
      lightNode.light = new SCNLight()
      lightNode.light.type = SCNLight.LightType.omni
      lightNode.position = new SCNVector3(0, 10, 10)
      scene.rootNode.addChildNode(lightNode)

      // create and add an ambient light to the scene
      const ambientLightNode = new SCNNode()
      ambientLightNode.light = new SCNLight()
      ambientLightNode.light.type = SCNLight.LightType.ambient
      ambientLightNode.light.color = SKColor.darkGray
      scene.rootNode.addChildNode(ambientLightNode)

      // retrieve the ship node
      const ship = scene.rootNode.childNodeWithNameRecursively('ship', true)

      // animate the 3d object
      const animation = new CABasicAnimation('rotation')
      animation.toValue = new SCNVector4(0, 1, 0, Math.PI * 2)
      animation.duration = 3
      animation.repeatCount = Infinity //repeat forever
      ship.addAnimationForKey(animation, null)

      // set the scene to the view
      this.gameView.scene = scene

      // allows the user to manipulate the camera
      this.gameView.allowsCameraControl = true

      // show statistics such as fps and timing information
      this.gameView.showsStatistics = true

      // configure the view
      this.gameView.backgroundColor = SKColor.black

      this.gameView.play()
    })
  }

}

