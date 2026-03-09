let messages = [];
let filteredMessages = [];

async function loadData() {
    const response = await fetch('data.json');
    messages = await response.json();
    filteredMessages = [...messages];
    populateSenders();
    displayMessages();
}

async function loadVersion() {
    try {
        const response = await fetch('version.json');
        const version = await response.json();
        const versionDiv = document.getElementById('version');
        const date = new Date(version.lastUpdated);
        versionDiv.textContent = `Last updated: ${date.toLocaleString()} | ${version.messageCount} messages`;
    } catch (e) {
        console.warn('Could not load version info');
    }
}

function populateSenders() {
    const senderSelect = document.getElementById('searchSender');
    const senders = [...new Set(messages.map(m => m.sender))];
    senders.forEach(sender => {
        const option = document.createElement('option');
        option.value = sender;
        option.textContent = sender;
        senderSelect.appendChild(option);
    });
    
    const typeSelect = document.getElementById('searchType');
    const types = [...new Set(messages.map(m => m.type))];
    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeSelect.appendChild(option);
    });
}

function displayMessages() {
    const container = document.getElementById('messages');
    container.innerHTML = '';
    filteredMessages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';
        
        const header = document.createElement('div');
        header.className = 'header';
        
        // build icon area; use image if available
        const icon = document.createElement('div');
        icon.className = 'icon';
        if (msg.iconUrl) {
            const imgEl = document.createElement('img');
            imgEl.src = msg.iconUrl;
            imgEl.alt = msg.type || '';
            imgEl.onerror = () => {
                imgEl.style.display = 'none';
            };
            icon.appendChild(imgEl);
        } else {
            icon.textContent = '●'; // placeholder
        }
        
        const sender = document.createElement('span');
        sender.className = 'sender';
        sender.textContent = msg.sender;
        
        const time = document.createElement('span');
        time.className = 'time';
        time.textContent = msg.dateISO ? new Date(msg.dateISO).toLocaleString('fr-FR') : '';
        
        const originalButton = document.createElement('button');
        originalButton.textContent = 'Voir l\'Original';
        originalButton.className = 'view-original';
        originalButton.onclick = () => {
            // construct or use fullBodyLink if available, else perhaps the base page
            if (msg.fullBodyLink) {
                window.open(msg.fullBodyLink, '_blank');
            } else {
                // fallback to the main messages page
                window.open('https://megamail25.com/322481225923/messages?', '_blank');
            }
        };
        
        header.appendChild(icon);
        header.appendChild(sender);
        header.appendChild(time);
        header.appendChild(originalButton);
        
        const body = document.createElement('div');
        body.className = 'body';
        // note: msg.body may already be full text because scraper followed link
        let cleanBody = msg.body;
        // remove date/time if at start
        const dateTimeRegex = /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s*/;
        cleanBody = cleanBody.replace(dateTimeRegex, '');
        // remove sender if at start
        if (msg.sender) {
            const senderRegex = new RegExp('^' + msg.sender.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[:\\s]*', 'i');
            cleanBody = cleanBody.replace(senderRegex, '');
        }
        // remove "Pièce jointe" and "Voir plus" from the end
        cleanBody = cleanBody.replace(/\s*Pièce jointe\s*$/i, '');
        cleanBody = cleanBody.replace(/\s*Voir plus\s*$/i, '');
        // remove excessive blank lines
        cleanBody = cleanBody.replace(/\n\s*\n+/g, '\n');
        // remove leading/trailing whitespace
        cleanBody = cleanBody.trim();
        
        // Convert URLs to clickable links while preserving newlines
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const lines = cleanBody.split('\n');
        const bodyFragment = document.createDocumentFragment();
        
        lines.forEach((line, index) => {
            const parts = line.split(urlRegex);
            parts.forEach((part) => {
                if (part.match(urlRegex)) {
                    const link = document.createElement('a');
                    link.href = part;
                    link.textContent = part;
                    link.target = '_blank';
                    body.appendChild(link);
                } else {
                    body.appendChild(document.createTextNode(part));
                }
            });
            if (index < lines.length - 1) {
                body.appendChild(document.createElement('br'));
            }
        });
        
        let attachment = null;
        if (msg.attachmentLink) {
            // create element depending on type
            if (msg.attachmentLink.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i)) {
                attachment = document.createElement('img');
                attachment.src = msg.attachmentLink;
                attachment.className = 'attachment image';
            } else {
                attachment = document.createElement('a');
                attachment.href = msg.attachmentLink;
                attachment.textContent = 'Pièce jointe';
                attachment.className = 'attachment link';
                attachment.target = '_blank';
            }
        }        
        const reply = msg.reply ? document.createElement('div') : null;
        if (reply) {
            reply.className = 'reply';
            reply.textContent = msg.reply;
        }
        
        msgDiv.appendChild(header);
        msgDiv.appendChild(body);
        if (attachment) msgDiv.appendChild(attachment);
        if (reply) msgDiv.appendChild(reply);
        
        container.appendChild(msgDiv);
    });
}

function filterMessages() {
    const text = document.getElementById('searchText').value.toLowerCase();
    const start = document.getElementById('searchDate').value; // YYYY-MM-DD
    const end = document.getElementById('searchDateEnd').value;
    const type = document.getElementById('searchType').value;
    const sender = document.getElementById('searchSender').value;
    
    filteredMessages = messages.filter(msg => {
        const msgDate = msg.dateISO ? msg.dateISO.slice(0,10) : '';
        let dateOk = true;
        if (start && msgDate < start) dateOk = false;
        if (end && msgDate > end) dateOk = false;
        return (text === '' || msg.body.toLowerCase().includes(text)) &&
               dateOk &&
               (type === '' || msg.type === type) &&
               (sender === '' || msg.sender === sender);
    });
    displayMessages();
}

document.getElementById('searchText').addEventListener('input', filterMessages);
document.getElementById('searchDate').addEventListener('change', filterMessages);
document.getElementById('searchDateEnd').addEventListener('change', filterMessages);
document.getElementById('searchType').addEventListener('change', filterMessages);
document.getElementById('searchSender').addEventListener('change', filterMessages);
document.getElementById('searchDateEnd').addEventListener('change', filterMessages);

loadVersion();
loadData();