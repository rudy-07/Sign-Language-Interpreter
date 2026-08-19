const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const imageUpload = document.getElementById('image-upload');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');

let currentImageFile = null;
let currentImageBase64 = null;

// Handle textarea auto-resize
chatInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Trigger file input when attach is clicked
attachBtn.addEventListener('click', () => {
    imageUpload.click();
});

// Handle image selection
imageUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        currentImageFile = file;

        // Use FileReader to get base64 data URL for preview and Puter.js
        const reader = new FileReader();
        reader.onload = (event) => {
            currentImageBase64 = event.target.result;
            imagePreview.src = currentImageBase64;
            imagePreviewContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
});

// Remove attached image
removeImageBtn.addEventListener('click', () => {
    currentImageFile = null;
    currentImageBase64 = null;
    imageUpload.value = ''; // clear input
    imagePreviewContainer.classList.add('hidden');
});

// Send message
sendBtn.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
});

function appendMessage(role, text, imageUrl = null) {
    const isUser = role === 'user';
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message slide-in ${isUser ? 'user-message' : 'ai-message'}`;

    // Monochrome minimalist SVG avatars
    const userAvatarIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    const aiAvatarIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`;

    const avatarIcon = isUser ? userAvatarIcon : aiAvatarIcon;
    const avatarClass = isUser ? 'user-avatar-minimal' : 'ai-avatar-minimal';

    let contentHtml = `<p style="margin: 0; white-space: pre-wrap;">${text}</p>`;

    if (imageUrl) {
        contentHtml = `<img src="${imageUrl}" style="max-width: 250px; border-radius: 8px; margin-bottom: 0.8rem; display: block; border: 1px solid #333;">` + contentHtml;
    }

    messageDiv.innerHTML = `
        <div class="avatar-minimal ${avatarClass}">${avatarIcon}</div>
        <div class="bubble-minimal">
            ${contentHtml}
        </div>
    `;

    chatHistory.appendChild(messageDiv);

    // Smooth scroll to bottom
    chatHistory.scrollTo({
        top: chatHistory.scrollHeight,
        behavior: 'smooth'
    });

    return messageDiv;
}

async function handleSendMessage() {
    const text = chatInput.value.trim();

    // Don't send if fully empty
    if (!text && !currentImageBase64) return;

    // 1. Add User Message to UI
    appendMessage('user', text || "Analyze this ASL gesture", currentImageBase64);

    // Save state for AI payload
    const payloadText = text || "What ASL sign is this? Describe it in detail.";
    const payloadImage = currentImageBase64;

    // Clear inputs
    chatInput.value = '';
    chatInput.style.height = 'auto'; // reset height
    currentImageFile = null;
    currentImageBase64 = null;
    imageUpload.value = '';
    imagePreviewContainer.classList.add('hidden');

    // 2. Show typing indicator
    const typingMsg = appendMessage('ai', 'Thinking...');

    try {
        let response;

        // Puter.js AI Chat API
        // With image: puter.ai.chat(prompt, imageDataUrl, { model })
        // Text only:  puter.ai.chat(prompt, { model })
        if (payloadImage) {
            response = await puter.ai.chat(
                payloadText,
                payloadImage,
                { model: "gpt-4o" } // GPT-4o for vision capabilities
            );
        } else {
            response = await puter.ai.chat(
                payloadText,
                { model: "gpt-4o-mini" }
            );
        }

        // 3. Remove typing message and show response
        chatHistory.removeChild(typingMsg);

        // puter.ai.chat returns a string directly
        appendMessage('ai', response);

    } catch (err) {
        console.error("Puter AI Error:", err);
        chatHistory.removeChild(typingMsg);

        let errorHint = "Could not get a response from the AI. Please check your internet connection and try again.";
        if (err.message && err.message.includes("signed in")) {
            errorHint = "Puter requires sign-in for free AI. A sign-in popup should appear — please allow it.";
        }
        appendMessage('ai', `⚠️ ${errorHint}\n\nDetails: ${err}`);
    }
}

// Handle Puter Sign Out
const puterSignoutBtn = document.getElementById('puter-signout-btn');
if (puterSignoutBtn) {
    puterSignoutBtn.addEventListener('click', () => {
        if (typeof puter !== 'undefined' && puter.auth) {
            if (puter.auth.isSignedIn()) {
                puter.auth.signOut();
                alert('Signed out of Puter successfully. Send a new message to sign in with a different account.');
            } else {
                alert('You are not currently signed into Puter.');
            }
        } else {
            alert('Puter.js is not initialized yet. Please wait a moment.');
        }
    });
}
