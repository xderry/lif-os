// from code.esm.sh
import React, {Component} from "react";
import {render} from "react-dom";
import Keyboard from "react-simple-keyboard@3.8.69";

// Instead of the default import, you can also use this:
// import { KeyboardReact as Keyboard } from "react-simple-keyboard"

import "react-simple-keyboard@3.8.69/build/css/index.css" with {type: 'css'};

class App extends Component {
  state = {
    layoutName: "default",
    input: ""
  };
  onChange = input=>{
    this.setState({ input });
    console.log("Input changed", input);
  };
  onKeyPress = button=>{
    console.log("Button pressed", button);
    // If you want to handle the shift and caps lock buttons
    if (button=="{shift}" || button=="{lock}")
      this.handleShift();
  };

  handleShift = ()=>{
    const layoutName = this.state.layoutName;
    this.setState({
      layoutName: layoutName=="default" ? "shift" : "default"
    });
  };

  onChangeInput = event=>{
    const input = event.target.value;
    this.setState({input});
    this.keyboard.setInput(input);
  };

  render(){
    return (
      <div>
        <input
          value={this.state.input}
          placeholder={"Tap on the virtual keyboard to start"}
          onChange={this.onChangeInput}
        />
        <Keyboard
          keyboardRef={r => (this.keyboard = r)}
          layoutName={this.state.layoutName}
          onChange={this.onChange}
          onKeyPress={this.onKeyPress}
        />
      </div>
    );
  }
}
export default App;

