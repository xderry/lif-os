import Keyboard from 'simple-keyboard@3.8.53';
import 'simple-keyboard@3.8.53/build/css/index.css' with {type: 'css'};

export const keyboard = new Keyboard.SimpleKeyboard({
  onChange: input => onChange(input),
  onKeyPress: button => onKeyPress(button)
});

export let ev = {
  onkey: null,
  getv: ()=>document.querySelector('.input').value,
  log: msg=>document.querySelector('#msg').textContent = msg,
};
function onChange(input){
  //document.querySelector(".input").value = input;
  //console.log("Input changed", input);
}

function onKeyPress(button){
  //console.log("Button pressed", button);
  ev.onkey?.(button);
}
addEventListener('keypress', e=>{
  //console.log("Key pressed", e.key);
  ev.onkey?.(e.key);
});

