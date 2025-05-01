const socket = io();
const button = document.getElementById("button");
const countDisplay = document.getElementById("count-display");


button.addEventListener("click", () => {
   socket.emit("click");
})

socket.on('updateCount', count => {
    counterDisplay.textContent = count;
  });