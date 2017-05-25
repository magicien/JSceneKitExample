'use strict'

import {
  SCNTransaction,
  SCNView,
  SKColor
} from 'jscenekit'

export default class GameView extends SCNView {
  mouseDownWith(theEvent) {
    console.log('mouseDown')
    /* Called when a mouse click occurs */

    // check what nodes are clicked
    const p = this.convertFrom(theEvent.locationInWindow, null)
    const hitResults = this.hitTest(p, {})
    // check that we clicked on at least one object
    if(hitResults.length > 0){
      // retrieved the first clicked object
      const result = hitResults[0]

      // get its material
      const material = result.node.geometry.firstMaterial

      // highlight it
      SCNTransaction.begin()
      SCNTransaction.animationDuration = 0.5

      // on completion - unhighlight
      SCNTransaction.completionBlock = () => {
        SCNTransaction.begin()
        SCNTransaction.animationDuration = 0.5

        material.emission.contents = SKColor.black

        SCNTransaction.commit()
      }

      material.emission.contents = SKColor.red

      SCNTransaction.commit()
    }

    super.mouseDownWith(theEvent)
  }
}
