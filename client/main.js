var button = document.getElementById("button");


button.addEventListener("click", function() {
    var num = document.getElementById("click-counter").textContent;
    var int = parseInt(num);
    int++;
    document.getElementById("click-counter").textContent = int;
})