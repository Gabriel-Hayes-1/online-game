const chat = document.getElementById("chat")
const chatbox = document.getElementById("chat-inp")
const chatSend = document.getElementById("chat-send")
const chatTeam = document.getElementById("chat-sel")
const msgArea = document.getElementById("msg")
const toggleButton = document.getElementById("chat-hide-button")

let hidden = false 
var teamSelect = document.getElementById("selectTeamName")

const maxMessages = 30

function sendChat() {
    if (chatbox.value.length>maxChatLen){
        chatbox.value = chatbox.value.slice(0,maxChatLen)
    } else if (chatbox.value==="") {
        return
    }
    socket.emit("chat",chatbox.value,chatTeam.value)
    chatbox.value=""
    chatbox.blur()
}

chatbox.addEventListener("keydown",event=>{
    const chatVal = chatbox.value
    const allowedKeys = ['Backspace','Delete','ArrowLeft','ArrowRight','Enter']
    if (chatVal.length>=maxChatLen && !allowedKeys.includes(event.key)){
        event.preventDefault()
    }

    if (event.key==="Enter"){
        sendChat();
    }
})

chatSend.addEventListener("click",event=>{
    sendChat();
})

function localChatmsg(msg) {
    //message with text in full italics, to signify local message
    const messageElem = document.createElement("div")
    messageElem.classList.add("chat-message")
    
    const msgElem = document.createElement("span")
    msgElem.classList.add("chat-msg")
    msgElem.style.fontStyle="italic"
    msgElem.style.color = 'rgb(180,180,180)'
    msgElem.textContent = msg
    
    messageElem.appendChild(msgElem)
    msgArea.appendChild(messageElem)

    if (msgArea.children.length>maxMessages){
        msgArea.removeChild(msgArea.children[0])
    }
}
localChatmsg("Welcome to the chat! Press 't' to type.")


socket.on("chat",(from,msg,team)=>{
    const wasAtBottom = msgArea.scrollTop + msgArea.clientHeight >= msgArea.scrollHeight - 5


    const messageElem = document.createElement("div")
    messageElem.classList.add("chat-message")

    const fromElem = document.createElement("span")
    fromElem.classList.add("chat-from")
    fromElem.textContent = nameFromID(from)+": "
    const t = teamFromID(from)
    if (t) {
        fromElem.style.color = t
    }

    if (team != "all") {
        const teamElm = document.createElement("span")
        if (team==="red"){
            teamElm.textContent="[RED] "
            teamElm.style.color="red"
            fromElem.prepend(teamElm)
        } else if (team==="blue"){
            teamElm.textContent="[BLUE] "
            teamElm.style.color="blue"
            fromElem.prepend(teamElm)
        }
    }
    

    const msgElem = document.createElement("span")
    msgElem.classList.add("chat-msg")
    msgElem.textContent = msg

    messageElem.appendChild(fromElem)
    messageElem.appendChild(msgElem)
    
    msgArea.appendChild(messageElem)

    if (wasAtBottom) {
        msgArea.scrollTop = msgArea.scrollHeight
    }

    if (msgArea.children.length>maxMessages){
        msgArea.removeChild(msgArea.children[0])
    }
})


toggleButton.addEventListener("click",event=>{
    hidden=!hidden
    chat.classList.toggle('hidden',hidden)
    toggleButton.classList.toggle('rotate',hidden)
})
document.addEventListener("keydown",e=>{
    if (e.key=="t") {
        if (document.getElementById("chat-inp")===document.activeElement) return
        hidden=false
        chat.classList.toggle('hidden',hidden)
        toggleButton.classList.toggle('rotate',hidden)
        chatbox.focus()
        e.preventDefault()
    }
})
