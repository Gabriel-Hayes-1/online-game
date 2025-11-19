const chat = document.getElementById("chat")
const chatbox = document.getElementById("chat-inp")
const chatSend = document.getElementById("chat-send")
const chatTeam = document.getElementById("chat-sel")
const msgArea = document.getElementById("msg")
const toggleButton = document.getElementById("chat-hide-button")

const nameScreen = document.querySelector(".name-screen");

const playerInfo = document.getElementById("player-info")
const playerInfoHealth = document.getElementById("health")
const playerInfoSubtitle = document.getElementById("subtitle")
const playerInfoName = document.getElementById("name")

const deadScreen = document.getElementById("dead")

const warnings = document.getElementById('warnings')

let hidden = false 
var teamSelect = document.getElementById("selectTeamName")

const maxMessages = 30


function sendChat() {
    if (chatbox.value.startsWith("/")) {
        chatbox.value=""
        chatbox.blur()
        parseCommand(chatbox.value)
        return
    }
    

    if (chatbox.value.length>maxChatLen){
        chatbox.value = chatbox.value.slice(0,maxChatLen)
    } else if (chatbox.value==="") {
        return
    }
    socket.emit("chat",chatbox.value,chatTeam.value)
    chatbox.value=""
    chatbox.blur()
}

function parseCommand(command) {
    localChatmsg("Commands coming soon!")
}

function nameRecievedUI(data) {
    nameScreen.classList.add("hidden")
    chat.classList.remove("hidden")
    warnings.classList.remove("hidden")

    playerInfoName.innerText=data.name
    playerInfoSubtitle.innerText = data.team
    playerInfo.style.display="flex"
    teamSelect.textContent = data.team.charAt(0).toUpperCase() + data.team.slice(1);
}

function deathUI(data) {
    
}

chatbox.addEventListener("keydown",event=>{
    const chatVal = chatbox.value
    const allowedKeys = ['Backspace','Delete','ArrowLeft','ArrowRight','Enter']
    if (chatVal.length>=maxChatLen && !allowedKeys.includes(event.key)){
        if (enteredName) {
            event.preventDefault()
        }
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
    fromElem.textContent = from.name+": "

    const t = from.team
    fromElem.style.color = t

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
    chat.classList.toggle('slideout',hidden)
    toggleButton.classList.toggle('rotate',hidden)
})
document.addEventListener("keydown",e=>{
    if (!enteredName) return

    if (e.key=="t"||e.key=="/") {
        if (document.getElementById("chat-inp")===document.activeElement) return
        hidden=false
        chat.classList.toggle('slideout',hidden)
        toggleButton.classList.toggle('rotate',hidden)
        chatbox.focus()
        if (e.key=="t"){
            e.preventDefault()
        }
    } 

})


function addWarning(text,time) {
    const element = document.createElement('div')
    element.textContent = text
    
    if (time) {
        const endTime = Date.now() + time
        const timeLeftSpan = document.createElement('span')
        timeLeftSpan.classList.add("warningTimer")
        element.appendChild(timeLeftSpan)

        const interval = setInterval(()=>{
            const timeLeft = endTime - Date.now()
            const deciSecondsLeft = Math.ceil(timeLeft/100)/10

            if (timeLeft<=0) {
               timeLeftSpan.textContent = " (0.0)"
               clearInterval(interval)
            } else {
                timeLeftSpan.textContent = ` (${deciSecondsLeft.toFixed(1)})`
            }

        },100)
        setTimeout(() => {
            element.remove()
        }, time);
    }

    warnings.appendChild(element) 
    return element
}